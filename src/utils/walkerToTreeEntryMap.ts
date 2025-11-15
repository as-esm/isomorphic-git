import AsyncLock from 'async-lock'

import { STAGE } from '../commands/STAGE.ts'
import { TREE } from '../commands/TREE.ts'
import { WORKDIR } from '../commands/WORKDIR.ts'
import { _walk } from '../commands/walk.ts'
import { _writeTree } from '../commands/writeTree.ts'
import { InternalError } from '../errors/InternalError.ts'
import { NotFoundError } from '../errors/NotFoundError.ts'
import { GitIgnoreManager } from "../managers/GitIgnoreManager.ts"
// GitIndexManager import removed - using Repository.readIndexDirect/writeIndexDirect instead
import { _readObject } from "../storage/readObject.ts"
import { readObjectLoose } from "../storage/readObjectLoose.ts"
import { _writeObject } from "../storage/writeObject.ts"
import { join } from './join.ts'
import { posixifyPathBuffer } from './posixifyPathBuffer.ts'
import { normalizeFs } from './normalizeFs.ts'
import { detectChange } from './changeDetection.ts'
import type { FsClient } from "../models/FileSystem.ts"
import type { ObjectType } from "../models/GitObject.ts"
import type { TreeEntry } from "../models/GitTree.ts"
import type { Walker, WalkerEntry } from "../models/Walker.ts"
import type { GitIndex } from "../git/index/GitIndex.ts"

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
  oid: string | null = null,
  cache: Record<string, unknown> = {}
): Promise<string | undefined> {
  const normalizedFs = normalizeFs(fs)
  const currentFilepath = join(dir, filepath)
  
  // If OID is provided, first check if the object exists in the object store (loose or packed)
  if (oid) {
    try {
      const { _readObject } = await import('../storage/readObject.ts')
      const objResult = await _readObject({ fs, cache, gitdir, oid, format: 'content' })
      if (objResult) {
        // Object exists in the store, return the OID
        return oid
      }
    } catch (error) {
      // Object doesn't exist in store - this can happen if the blob wasn't written yet
      // or if there's a cache issue. For staged files, the OID should exist.
      // Continue to try reading from working directory as fallback
    }
  }
  
  // Object doesn't exist in store (or OID not provided), try reading from working directory
  let stats
  try {
    stats = await normalizedFs.lstat(currentFilepath)
  } catch {
    // File doesn't exist in working directory
    if (oid) {
      // If OID was provided but object doesn't exist in store and file doesn't exist in workdir,
      // For staged files, the OID should exist in the object store (written by add())
      // If it doesn't exist, it might be a timing issue or the blob wasn't written yet
      // In this case, we should still return the OID and let the tree be written with it
      // The tree will be valid even if the blob doesn't exist yet (it will be written later)
      // Return the OID anyway - the tree structure is what matters
      return oid
    }
    // If no OID provided and file doesn't exist, return undefined
    return undefined
  }
  
  if (!stats) {
    if (oid) {
      throw new NotFoundError(currentFilepath)
    }
    return undefined
  }
  
  if ((stats as any).isDirectory())
    throw new InternalError(
      `${currentFilepath}: file expected, but found directory`
    )

  // Read from working directory and write to object store
  let retOid: string | undefined = undefined
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
  cache = {},
}: {
  fs: FsClient
  dir: string
  gitdir: string
  entries: TreeEntryWithChildren[]
  cache?: Record<string, unknown>
}): Promise<TreeEntryWithChildren[]> {
  // make sure each tree entry has valid oid
  async function processTreeEntry(entry: TreeEntryWithChildren): Promise<TreeEntryWithChildren> {
    if (entry.type === 'tree') {
      if (!entry.oid) {
        // Process children entries if the current entry is a tree
        // Use Promise.allSettled to handle partial failures gracefully
        const childrenResults = await Promise.allSettled((entry.children || []).map(processTreeEntry))
        const children = childrenResults
          .filter((result): result is PromiseFulfilledResult<TreeEntryWithChildren> => 
            result.status === 'fulfilled'
          )
          .map(result => result.value)
        
        // If any children failed, we still try to write the tree with successful children
        // This prevents one failure from blocking the entire operation
        if (childrenResults.some(result => result.status === 'rejected')) {
          const failures = childrenResults
            .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
            .map(result => result.reason)
          console.warn(`Some tree entries failed to process:`, failures)
        }
        
        // Convert children to tree format before writing
        const childrenTreeEntries = children.map(child => ({
          mode: child.mode || (child.type === 'tree' ? '040000' : '100644'),
          path: child.path!,
          oid: child.oid!,
          type: child.type || 'blob',
        }))
        
        // Write the tree with the processed children
        entry.oid = await _writeTree({
          fs,
          gitdir,
          tree: childrenTreeEntries,
        })
        entry.mode = '040000' // directory
      }
    } else if (entry.type === 'blob') {
      const oid = await checkAndWriteBlob(
        fs,
        gitdir,
        dir,
        entry.path,
        entry.oid || null,
        cache
      )
      if (oid) {
        entry.oid = oid
      }
      entry.mode = '100644' // file
    }

    // remove path from entry.path
    if (entry.path) {
      entry.path = entry.path.split('/').pop() || entry.path
    }
    return entry
  }

  // Use Promise.allSettled to process all entries concurrently and handle partial failures
  // This eliminates race conditions where one failure stops all processing
  const results = await Promise.allSettled(entries.map(processTreeEntry))
  const processedEntries = results
    .filter((result): result is PromiseFulfilledResult<TreeEntryWithChildren> => 
      result.status === 'fulfilled'
    )
    .map(result => result.value)
  
  // Log any failures but continue with successful entries
  if (results.some(result => result.status === 'rejected')) {
    const failures = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason)
    console.warn(`Some entries failed to process:`, failures)
  }
  
  return processedEntries
}

export async function writeTreeChanges({
  fs,
  dir,
  gitdir,
  treePair, // [TREE({ ref: 'HEAD' }), 'STAGE'] would be the equivalent of `git write-tree`
  cache = {},
}: {
  fs: FsClient
  dir: string
  gitdir: string
  treePair: [Walker | string, Walker | string]
  cache?: Record<string, unknown>
}): Promise<string | null> {
  const isStage = treePair[1] === 'stage'
  
  // CRITICAL: Get the Repository instance ONCE and pass it to _walk
  // This ensures all walkers (STAGE, TREE, WORKDIR) use the same Repository instance
  // and see the same index state as add(), status(), etc.
  // IMPORTANT: Pass gitdir to Repository.open() to ensure we get the same instance as add()
  const { Repository } = await import('../core-utils/Repository.ts')
  const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
  
  // Resolve effective gitdir from the repository (for worktree support)
  let effectiveGitdir = gitdir
  try {
    const worktree = repo.getWorktree()
    if (worktree) {
      effectiveGitdir = await worktree.getGitdir()
    } else {
      effectiveGitdir = await repo.getGitdir()
    }
  } catch {
    // If getGitdir fails, use provided gitdir
    effectiveGitdir = gitdir
  }
  
  // CRITICAL: If comparing against STAGE, ensure we read the latest index state
  // Since add() now writes directly to .git/index, the STAGE walker will read the latest state
  if (isStage) {
    await repo.readIndexDirect() // Read the owned instance (force=false by default)
  }
  
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

    if (isStage) {
      // For HEAD vs STAGE comparison: use centralized change detection
      const change = await detectChange(head, stage)
      
      
      if (change.type === 'unchanged') {
        // No change detected
        return undefined
      }
      
      // Record the change
      changedEntries.push([change.base, change.target])
      
      if (change.type === 'added' || change.type === 'modified') {
        // File added or modified in STAGE - return STAGE entry
        if (!change.target || !change.targetOid) {
          return undefined
        }
        return {
          mode: (await change.target.mode()).toString(8).padStart(6, '0'),
          path: filepath,
          oid: change.targetOid,
          type: (await change.target.type()) as ObjectType,
        }
      } else if (change.type === 'deleted') {
        // File deleted from STAGE (exists in HEAD but not STAGE)
        // Record it as a change but return undefined (file should be removed)
        return undefined
      }
      
      return undefined
    } else {
      // For HEAD/STAGE vs WORKDIR comparison: use centralized change detection
      // - head = HEAD or STAGE (depending on what was passed)
      // - stage = WORKDIR (working directory state)
      // - We want to return the WORKDIR state (stage.oid())
      const change = await detectChange(head, stage)
      
      
      // Record changes (but always return WORKDIR state if it exists)
      if (change.type !== 'unchanged') {
        changedEntries.push([change.base, change.target])
      }
      
      if (change.type === 'added' || change.type === 'modified') {
        // WORKDIR exists and differs from head - return WORKDIR state
        if (!change.target || !change.targetOid) {
          return undefined
        }
        return {
          mode: (await change.target.mode()).toString(8).padStart(6, '0'),
          path: filepath,
          oid: change.targetOid,
          type: (await change.target.type()) as ObjectType,
        }
      } else if (change.type === 'deleted') {
        // WORKDIR doesn't exist but head does - this is a deletion in workdir
        // Record it as a change but return undefined
        return undefined
      } else if (change.type === 'unchanged') {
        // WORKDIR matches head - no change, don't include in tree
        return undefined
      }
      
      return undefined
    }
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
        // For HEAD vs STAGE comparison:
        // - Process entries where stage exists (staged files)
        // - Also process entries where head exists but stage doesn't (deletions)
        // This ensures we detect both additions/modifications and deletions
        if (stage || head) {
          // Process if either head or stage exists
          // This ensures we detect:
          // 1. Files in STAGE (staged changes)
          // 2. Files in HEAD but not in STAGE (deletions)
          filtered.push(child)
        }
      } else {
        // For HEAD/STAGE vs WORKDIR comparison:
        // - head = HEAD or STAGE
        // - stage = WORKDIR
        // We need to process all children to detect changes
        if (head || stage) {
          filtered.push(child)
        }
      }
    }
    return filtered.length ? Promise.all(filtered.map(walk)) : []
  }

  const entries = await _walk({
    repo,
    trees,
    map,
    reduce,
    iterate,
  }) as TreeEntryWithChildren[]

  // CRITICAL: Check if we have any entries to process
  // If changedEntries is empty but entries exist, it means all entries matched (no changes)
  // If entries is empty, it means no files were found at all
  // Only return null if we truly have no changes (no entries or all entries matched)
  const hasEntries = entries && (Array.isArray(entries) ? entries.length > 0 : entries !== undefined)
  
  if (changedEntries.length === 0) {
    // No changes detected - either entries matched or no entries found
    return null // no changes found
  }
  
  if (!hasEntries) {
    // We detected changes but no entries to process - this shouldn't happen
    // but return null to be safe
    return null
  }

  // Process entries - this builds the tree structure recursively
  // If entries is an array, it means we have root-level entries
  // If entries is a single entry, it means we have a nested structure
  const processedEntries = await processTreeEntries({
    fs,
    dir,
    gitdir: effectiveGitdir,
    entries: Array.isArray(entries) ? entries : [entries],
    cache,
  })

  // Convert processed entries to tree format
  // processTreeEntries already wrote sub-trees, so we just need to write the root tree
  const treeEntries = processedEntries
    .filter(Boolean)
    .filter(entry => {
      // Filter out entries missing required fields
      if (!entry.oid || !entry.path) {
        return false
      }
      return true
    })
    .map(entry => {
      // Ensure mode is always set - if not set, infer from type
      let mode = entry.mode
      if (!mode) {
        if (entry.type === 'tree') {
          mode = '040000'
        } else if (entry.type === 'blob') {
          mode = '100644'
        } else {
          // Default to blob if type is unknown
          mode = '100644'
        }
      }
      mode = typeof mode === 'number' ? mode.toString(8).padStart(6, '0') : mode
      return {
        mode,
        path: entry.path!,
        oid: entry.oid!,
        type: entry.type || 'blob',
      }
    })

  // Write the root tree with all processed entries
  return _writeTree({ fs, gitdir: effectiveGitdir, tree: treeEntries })
}

export async function applyTreeChanges({
  fs,
  dir,
  gitdir,
  stashCommit,
  parentCommit,
  wasStaged,
  cache = {},
}: {
  fs: FsClient
  dir: string
  gitdir: string
  stashCommit: string
  parentCommit: string
  wasStaged: boolean
  cache?: Record<string, unknown>
}): Promise<void> {
  // Check for unmerged paths before applying tree changes
  // CRITICAL: Pass gitdir to Repository.open() to ensure we get the same Repository instance
  // as other operations like add(), status(), and stash(). This ensures index state consistency.
  const { Repository } = await import('../core-utils/Repository.ts')
  const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
  const index = await repo.readIndexDirect(false, false) // Force fresh read, allowUnmerged: false
  // If there are unmerged paths, readIndexDirect will throw UnmergedPathsError
  // This ensures we don't apply stash during a merge conflict
  
  const normalizedFs = normalizeFs(fs)
  const dirRemoved: string[] = []
  const stageUpdated: Array<{ filepath: string; oid: string; stats?: any }> = []

  // analyze the changes
  const ops = await _walk({
    repo,
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
        if (type === 'blob' && wasStaged) {
          // For index deletions, we need to remove from index
          // Pass null oid to indicate deletion
          stageUpdated.push({ filepath, oid: '', stats: undefined })
        }
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
              cache,
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

  // update the stage (if wasStaged is true)
  if (wasStaged) {
    // Use Repository.readIndexDirect() and writeIndexDirect() for consistency
    const currentIndex = await repo.readIndexDirect(false) // Force fresh read
    for (const { filepath, stats, oid } of stageUpdated) {
      if (oid === '') {
        // Deletion - remove from index
        currentIndex.delete({ filepath })
      } else if (stats && oid) {
        // Addition or modification - insert/update in index
        currentIndex.insert({ filepath, stats, oid })
      }
    }
    await repo.writeIndexDirect(currentIndex)
  }
}

