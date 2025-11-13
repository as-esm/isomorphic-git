import AsyncLock from 'async-lock'

import { STAGE } from "../commands/STAGE.js"
import { TREE } from "../commands/TREE.js"
import { WORKDIR } from "../commands/WORKDIR.js"
import { _walk } from "../commands/walk.js"
import { _writeTree } from "../commands/writeTree.js"
import { InternalError } from '../errors/InternalError.js'
import { NotFoundError } from '../errors/NotFoundError.js'
import { GitIgnoreManager } from "../managers/GitIgnoreManager.ts"
import { GitIndexManager } from "../managers/GitIndexManager.ts"
import { _readObject } from "../storage/readObject.ts"
import { readObjectLoose } from "../storage/readObjectLoose.ts"
import { _writeObject } from "../storage/writeObject.ts"
import { join } from './join.js'
import { posixifyPathBuffer } from './posixifyPathBuffer.js'
import { normalizeFs } from './normalizeFs.js'
import type { FsClient } from "../models/FileSystem.ts"
import type { ObjectType } from "../models/GitObject.ts"
import type { TreeEntry } from "../models/GitTree.ts"
import type { Walker, WalkerEntry } from "../models/Walker.ts"
import type { GitIndex } from "../models/GitIndex.ts"

const _TreeMap: Record<string, () => Walker> = {
  stage: STAGE,
  workdir: WORKDIR,
}

let lock: AsyncLock | undefined
export async function acquireLock<T>(ref: string | { filepath: string }, callback: () => Promise<T>): Promise<T> {
  if (lock === undefined) lock = new AsyncLock()
  const lockKey = typeof ref === 'string' ? ref : ref.filepath
  return lock.acquire(lockKey, callback)
}

// make sure filepath, blob type and blob object (from loose objects) plus oid are in sync and valid
async function checkAndWriteBlob(
  fs: FsClient,
  gitdir: string,
  dir: string,
  filepath: string,
  oid: string | null = null
): Promise<string | undefined> {
  const normalizedFs = normalizeFs(fs)
  const currentFilepath = join(dir, filepath)
  const stats = await normalizedFs.lstat(currentFilepath)
  if (!stats) throw new NotFoundError(currentFilepath)
  if ((stats as any).isDirectory())
    throw new InternalError(
      `${currentFilepath}: file expected, but found directory`
    )

  // Look for it in the loose object directory.
  const objContent = oid
    ? await readObjectLoose({ fs, gitdir, oid })
    : undefined
  let retOid: string | undefined = objContent ? oid || undefined : undefined
  if (!objContent) {
    await acquireLock({ filepath: currentFilepath }, async () => {
      const object = (stats as any).isSymbolicLink()
        ? await normalizedFs.readlink(currentFilepath).then((link: Buffer | string | null) => {
            if (link === null) throw new NotFoundError(currentFilepath)
            return posixifyPathBuffer(Buffer.isBuffer(link) ? link : Buffer.from(link))
          })
        : await normalizedFs.read(currentFilepath)

      if (object === null) throw new NotFoundError(currentFilepath)

      const objectBuffer = Buffer.isBuffer(object) ? object : Buffer.from(object as string | Uint8Array)
      retOid = await _writeObject({ fs, gitdir, type: 'blob', object: objectBuffer })
    })
  }

  return retOid
}

interface TreeEntryWithChildren {
  mode: string | number
  path: string
  oid?: string
  type: ObjectType
  children?: TreeEntryWithChildren[]
}

async function processTreeEntries({
  fs,
  dir,
  gitdir,
  entries,
}: {
  fs: FsClient
  dir: string
  gitdir: string
  entries: TreeEntryWithChildren[]
}): Promise<TreeEntryWithChildren[]> {
  // make sure each tree entry has valid oid
  async function processTreeEntry(entry: TreeEntryWithChildren): Promise<TreeEntryWithChildren> {
    if (entry.type === 'tree') {
      if (!entry.oid) {
        // Process children entries if the current entry is a tree
        const children = await Promise.all((entry.children || []).map(processTreeEntry))
        // Write the tree with the processed children
        entry.oid = await _writeTree({
          fs,
          gitdir,
          tree: children,
        })
        entry.mode = '040000' // directory
      }
    } else if (entry.type === 'blob') {
      const oid = await checkAndWriteBlob(
        fs,
        gitdir,
        dir,
        entry.path,
        entry.oid || null
      )
      if (oid) {
        entry.oid = oid
      }
      entry.mode = '100644' // file
    }

    // remove path from entry.path
    entry.path = entry.path.split('/').pop() || entry.path
    return entry
  }

  return Promise.all(entries.map(processTreeEntry))
}

export async function writeTreeChanges({
  fs,
  dir,
  gitdir,
  treePair, // [TREE({ ref: 'HEAD' }), 'STAGE'] would be the equivalent of `git write-tree`
}: {
  fs: FsClient
  dir: string
  gitdir: string
  treePair: [Walker | string, Walker | string]
}): Promise<string | null> {
  const isStage = treePair[1] === 'stage'
  const trees = treePair.map(t => (typeof t === 'string' ? _TreeMap[t]() : t)) as Array<{ [key: symbol]: unknown }>

  const changedEntries: Array<[WalkerEntry | null, WalkerEntry | null]> = []
  // transform WalkerEntry objects into the desired format
  const map = async (filepath: string, [head, stage]: (WalkerEntry | null)[]): Promise<TreeEntry | undefined> => {
    if (
      filepath === '.' ||
      (await GitIgnoreManager.isIgnored({ fs, dir, gitdir, filepath }))
    ) {
      return undefined
    }

    if (stage) {
      if (
        !head ||
        ((await head.oid()) !== (await stage.oid()) &&
          (await stage.oid()) !== undefined)
      ) {
        changedEntries.push([head, stage])
      }
      return {
        mode: (await stage.mode()).toString(8).padStart(6, '0'),
        path: filepath,
        oid: await stage.oid(),
        type: (await stage.type()) as ObjectType,
      }
    }
    return undefined
  }

  // combine mapped entries with their parent results
  const reduce = async (parent: TreeEntryWithChildren | undefined, children: TreeEntry[]): Promise<TreeEntryWithChildren | TreeEntryWithChildren[] | undefined> => {
    const filteredChildren = children.filter(Boolean) // Remove undefined entries
    if (!parent) {
      return filteredChildren.length > 0 ? (filteredChildren as TreeEntryWithChildren[]) : undefined
    } else {
      parent.children = filteredChildren as TreeEntryWithChildren[]
      return parent
    }
  }

  // if parent is skipped, skip the children
  const iterate = async (walk: (child: (WalkerEntry | null)[]) => Promise<any>, children: (WalkerEntry | null)[][]): Promise<any[]> => {
    const filtered: (WalkerEntry | null)[][] = []
    for (const child of children) {
      const [head, stage] = child
      if (isStage) {
        if (stage) {
          // for deleted file in work dir, it also needs to be added on stage
          // Note: We can't check filepath here as iterate doesn't receive it
          // This logic may need to be moved to the map function
          filtered.push(child)
        }
      } else if (head) {
        // for deleted file in workdir, "stage" (workdir in our case) will be undefined
        if (!stage) {
          changedEntries.push([head, null]) // record the change (deletion) while stop the iteration
        } else {
          filtered.push(child) // workdir, tracked only
        }
      }
    }
    return filtered.length ? Promise.all(filtered.map(walk)) : []
  }

  const entries = await _walk({
    fs,
    cache: {},
    dir,
    gitdir,
    trees,
    map,
    reduce,
    iterate,
  }) as TreeEntryWithChildren[]

  if (changedEntries.length === 0 || !entries || entries.length === 0) {
    return null // no changes found to stash
  }

  const processedEntries = await processTreeEntries({
    fs,
    dir,
    gitdir,
    entries: Array.isArray(entries) ? entries : [entries],
  })

  const treeEntries = processedEntries.filter(Boolean).map(entry => {
    const mode = typeof entry.mode === 'number' ? entry.mode.toString(8).padStart(6, '0') : entry.mode
    return {
      mode,
      path: entry.path,
      oid: entry.oid || '',
      type: entry.type,
    }
  })

  return _writeTree({ fs, gitdir, tree: treeEntries })
}

export async function applyTreeChanges({
  fs,
  dir,
  gitdir,
  stashCommit,
  parentCommit,
  wasStaged,
}: {
  fs: FsClient
  dir: string
  gitdir: string
  stashCommit: string
  parentCommit: string
  wasStaged: boolean
}): Promise<void> {
  const normalizedFs = normalizeFs(fs)
  const dirRemoved: string[] = []
  const stageUpdated: Array<{ filepath: string; oid: string; stats?: any }> = []

  // analyze the changes
  const ops = await _walk({
    fs,
    cache: {},
    dir,
    gitdir,
    trees: [TREE({ ref: parentCommit }), TREE({ ref: stashCommit })],
    map: async (filepath: string, [parent, stash]: (WalkerEntry | null)[]): Promise<{ method: string; filepath: string; oid?: string } | undefined> => {
      if (
        filepath === '.' ||
        (await GitIgnoreManager.isIgnored({ fs, dir, gitdir, filepath }))
      ) {
        return undefined
      }
      const type = stash ? await stash.type() : (parent ? await parent.type() : 'blob')
      if (type !== 'tree' && type !== 'blob') {
        return undefined
      }

      // deleted tree or blob
      if (!stash && parent) {
        const method = type === 'tree' ? 'rmdir' : 'rm'
        if (type === 'tree') dirRemoved.push(filepath)
        if (type === 'blob' && wasStaged)
          stageUpdated.push({ filepath, oid: await parent.oid() }) // stats is undefined, will stage the deletion with index.insert
        return { method, filepath }
      }

      if (!stash) return undefined
      const oid = await stash.oid()
      if (!parent || (await parent.oid()) !== oid) {
        // only apply changes if changed from the parent commit or doesn't exist in the parent commit
        if (type === 'tree') {
          return { method: 'mkdir', filepath }
        } else {
          if (wasStaged) {
            const stats = await normalizedFs.lstat(join(dir, filepath))
            stageUpdated.push({
              filepath,
              oid,
              stats,
            })
          }
          return {
            method: 'write',
            filepath,
            oid,
          }
        }
      }
      return undefined
    },
  }) as Array<{ method: string; filepath: string; oid?: string }>

  // apply the changes to work dir
  await acquireLock('applyTreeChanges', async () => {
    for (const op of ops) {
      if (!op) continue
      const currentFilepath = join(dir, op.filepath)
      switch (op.method) {
        case 'rmdir':
          await normalizedFs.rmdir(currentFilepath)
          break
        case 'mkdir':
          await normalizedFs.mkdir(currentFilepath)
          break
        case 'rm':
          await normalizedFs.rm(currentFilepath)
          break
        case 'write':
          // only writes if file is not in the removedDirs
          if (
            !dirRemoved.some(removedDir =>
              currentFilepath.startsWith(removedDir)
            )
          ) {
            const { object } = await _readObject({
              fs,
              cache: {},
              gitdir,
              oid: op.oid || '',
            })
            // just like checkout, since mode only applicable to create, not update, delete first
            if (await normalizedFs.exists(currentFilepath)) {
              await normalizedFs.rm(currentFilepath)
            }
            const objectBuffer = Buffer.isBuffer(object) ? object : Buffer.from(object as Uint8Array)
            await normalizedFs.write(currentFilepath, objectBuffer) // only handles regular files for now
          }
          break
      }
    }
  })

  // update the stage
  await GitIndexManager.acquire({ fs, gitdir, cache: {} }, async (index: GitIndex) => {
    for (const { filepath, stats, oid } of stageUpdated) {
      if (stats && oid) {
        index.insert({ filepath, stats, oid })
      }
    }
  })
}

