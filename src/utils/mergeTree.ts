import { TREE } from '../commands/TREE.ts'
import { _walk } from '../commands/walk.ts'
import { MergeConflictError } from '../errors/MergeConflictError.ts'
import { MergeNotSupportedError } from '../errors/MergeNotSupportedError.ts'
import { GitTree } from "../models/GitTree.ts"
import { _writeObject as writeObject } from "../storage/writeObject.ts"
import { basename } from './basename.ts'
import { join } from './join.ts'
import { mergeFile } from './mergeFile.ts'
import { modified } from './modified.ts'
import { normalizeFs } from './normalizeFs.ts'
import type { FsClient } from "../models/FileSystem.ts"
import type { MergeDriverCallback, MergeDriverParams } from "../core-utils/algorithms/MergeManager.ts"
import type { ObjectType } from "../models/GitObject.ts"
import type { TreeEntry } from "../models/GitTree.ts"
import type { WalkerEntry } from "../models/Walker.ts"
import type { GitIndex } from "../models/GitIndex.ts"

/**
 * Create a merged tree
 *
 * @param {Object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {object} args.cache
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ourOid - The SHA-1 object id of our tree
 * @param {string} args.baseOid - The SHA-1 object id of the base tree
 * @param {string} args.theirOid - The SHA-1 object id of their tree
 * @param {string} [args.ourName='ours'] - The name to use in conflicted files for our hunks
 * @param {string} [args.baseName='base'] - The name to use in conflicted files (in diff3 format) for the base hunks
 * @param {string} [args.theirName='theirs'] - The name to use in conflicted files for their hunks
 * @param {boolean} [args.dryRun=false]
 * @param {boolean} [args.abortOnConflict=false]
 * @param {MergeDriverCallback} [args.mergeDriver]
 *
 * @returns {Promise<string>} - The SHA-1 object id of the merged tree
 *
 */
export async function mergeTree({
  fs,
  cache,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  index,
  ourOid,
  baseOid,
  theirOid,
  ourName = 'ours',
  baseName = 'base',
  theirName = 'theirs',
  dryRun = false,
  abortOnConflict = true,
  mergeDriver,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  dir?: string
  gitdir?: string
  index: GitIndex
  ourOid: string
  baseOid: string
  theirOid: string
  ourName?: string
  baseName?: string
  theirName?: string
  dryRun?: boolean
  abortOnConflict?: boolean
  mergeDriver?: MergeDriverCallback
}): Promise<string | MergeConflictError> {
  if (!gitdir) {
    throw new Error('gitdir is required')
  }
  const ourTree = TREE({ ref: ourOid })
  const baseTree = TREE({ ref: baseOid })
  const theirTree = TREE({ ref: theirOid })

  const unmergedFiles: string[] = []
  const bothModified: string[] = []
  const deleteByUs: string[] = []
  const deleteByTheirs: string[] = []

  const results = await _walk({
    fs,
    cache,
    dir,
    gitdir,
    trees: [ourTree, baseTree, theirTree],
    map: async function (filepath: string, [ours, base, theirs]: (WalkerEntry | null)[]): Promise<TreeEntry | undefined> {
      const path = basename(filepath)
      // What we did, what they did
      const ourChange = await modified(ours, base)
      const theirChange = await modified(theirs, base)
      switch (`${ourChange}-${theirChange}`) {
        case 'false-false': {
          if (!base) return undefined
      return {
        mode: (await base.mode()).toString(8).padStart(6, '0'),
        path,
        oid: await base.oid(),
        type: (await base.type()) as ObjectType,
      }
        }
        case 'false-true': {
          // if directory is deleted in theirs but not in ours we return our directory
          if (!theirs && ours && (await ours.type()) === 'tree') {
            return {
              mode: (await ours.mode()).toString(8).padStart(6, '0'),
              path,
              oid: await ours.oid(),
              type: (await ours.type()) as ObjectType,
            }
          }

          return theirs
            ? {
                mode: (await theirs.mode()).toString(8).padStart(6, '0'),
                path,
                oid: await theirs.oid(),
                type: (await theirs.type()) as ObjectType,
              }
            : undefined
        }
        case 'true-false': {
          // if directory is deleted in ours but not in theirs we return their directory
          if (!ours && theirs && (await theirs.type()) === 'tree') {
            return {
              mode: (await theirs.mode()).toString(8).padStart(6, '0'),
              path,
              oid: await theirs.oid(),
              type: (await theirs.type()) as ObjectType,
            }
          }

          return ours
            ? {
                mode: (await ours.mode()).toString(8).padStart(6, '0'),
                path,
                oid: await ours.oid(),
                type: (await ours.type()) as ObjectType,
              }
            : undefined
        }
        case 'true-true': {
          // Handle tree-tree merges (directories)
          if (
            ours &&
            theirs &&
            (await ours.type()) === 'tree' &&
            (await theirs.type()) === 'tree'
          ) {
            return {
              mode: (await ours.mode()).toString(8).padStart(6, '0'),
              path,
              oid: await ours.oid(),
              type: 'tree',
            }
          }

          // Modifications - both are blobs
          if (
            ours &&
            theirs &&
            (await ours.type()) === 'blob' &&
            (await theirs.type()) === 'blob'
          ) {
            return mergeBlobs({
              fs,
              gitdir,
              path,
              ours,
              base,
              theirs,
              ourName,
              baseName,
              theirName,
              mergeDriver,
            }).then(async r => {
              if (!r.cleanMerge) {
                unmergedFiles.push(filepath)
                bothModified.push(filepath)
                if (!abortOnConflict) {
                  let baseOidValue = ''
                  if (base && (await base.type()) === 'blob') {
                    baseOidValue = await base.oid()
                  }
                  const ourOidValue = await ours.oid()
                  const theirOidValue = await theirs.oid()

                  index.delete({ filepath })

                  if (baseOidValue && base) {
                    const baseStats = await base.stat()
                    index.insert({ filepath, stats: baseStats, oid: baseOidValue, stage: 1 })
                  }
                  const ourStats = await ours.stat()
                  index.insert({ filepath, stats: ourStats, oid: ourOidValue, stage: 2 })
                  const theirStats = await theirs.stat()
                  index.insert({ filepath, stats: theirStats, oid: theirOidValue, stage: 3 })
                }
              } else if (!abortOnConflict) {
                const stats = await ours.stat()
                index.insert({ filepath, stats, oid: r.mergeResult.oid, stage: 0 })
              }
              return r.mergeResult
            })
          }

          // deleted by us
          if (
            base &&
            !ours &&
            theirs &&
            (await base.type()) === 'blob' &&
            (await theirs.type()) === 'blob'
          ) {
            unmergedFiles.push(filepath)
            deleteByUs.push(filepath)
            if (!abortOnConflict) {
              const baseOidValue = await base.oid()
              const theirOidValue = await theirs.oid()

              index.delete({ filepath })

              const baseStats = await base.stat()
              index.insert({ filepath, stats: baseStats, oid: baseOidValue, stage: 1 })
              const theirStats = await theirs.stat()
              index.insert({ filepath, stats: theirStats, oid: theirOidValue, stage: 3 })
            }

            return {
              mode: (await theirs.mode()).toString(8).padStart(6, '0'),
              oid: await theirs.oid(),
              type: 'blob',
              path,
            }
          }

          // deleted by theirs
          if (
            base &&
            ours &&
            !theirs &&
            (await base.type()) === 'blob' &&
            (await ours.type()) === 'blob'
          ) {
            unmergedFiles.push(filepath)
            deleteByTheirs.push(filepath)
            if (!abortOnConflict) {
              const baseOidValue = await base.oid()
              const ourOidValue = await ours.oid()

              index.delete({ filepath })

              const baseStats = await base.stat()
              index.insert({ filepath, stats: baseStats, oid: baseOidValue, stage: 1 })
              const ourStats = await ours.stat()
              index.insert({ filepath, stats: ourStats, oid: ourOidValue, stage: 2 })
            }

            return {
              mode: (await ours.mode()).toString(8).padStart(6, '0'),
              oid: await ours.oid(),
              type: 'blob',
              path,
            }
          }

          // deleted by both
          if (
            base &&
            !ours &&
            !theirs &&
            ((await base.type()) === 'blob' || (await base.type()) === 'tree')
          ) {
            return undefined
          }

          // all other types of conflicts fail
          // TODO: Merge conflicts involving additions
          throw new MergeNotSupportedError()
        }
      }
    },
    /**
     * @param {TreeEntry} [parent]
     * @param {Array<TreeEntry>} children
     */
    reduce:
      unmergedFiles.length !== 0 && (!dir || abortOnConflict)
        ? undefined
        : async (parent: TreeEntry | undefined, children: TreeEntry[]): Promise<TreeEntry | undefined> => {
            const entries = children.filter(Boolean) // remove undefineds

            // if the parent was deleted, the children have to go
            if (!parent) return undefined

            // automatically delete directories if they have been emptied
            // except for the root directory
            if (
              parent &&
              parent.type === 'tree' &&
              entries.length === 0 &&
              parent.path !== '.'
            )
              return undefined

            if (
              entries.length > 0 ||
              (parent.path === '.' && entries.length === 0)
            ) {
              const tree = new GitTree(entries)
              const object = tree.toObject()
              const oid = await writeObject({
                fs,
                gitdir,
                type: 'tree',
                object,
                dryRun,
              })
              parent.oid = oid
            }
            return parent
          },
  })

  if (unmergedFiles.length !== 0) {
    if (dir && !abortOnConflict) {
      const normalizedFs = normalizeFs(fs)
      await _walk({
        fs,
        cache,
        dir,
        gitdir,
        trees: [TREE({ ref: results.oid })],
        map: async function (filepath: string, [entry]: (WalkerEntry | null)[]): Promise<boolean> {
          if (!entry) return false
          const path = `${dir}/${filepath}`
          if ((await entry.type()) === 'blob') {
            const mode = await entry.mode()
            const content = await entry.content()
            if (content) {
              const contentStr = new TextDecoder().decode(content)
              await normalizedFs.write(path, contentStr, { mode })
            }
          }
          return true
        },
      })
    }
    return new MergeConflictError(
      unmergedFiles,
      bothModified,
      deleteByUs,
      deleteByTheirs
    )
  }

  return results.oid
}

/**
 *
 * @param {Object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {string} args.path
 * @param {WalkerEntry} args.ours
 * @param {WalkerEntry} args.base
 * @param {WalkerEntry} args.theirs
 * @param {string} [args.ourName]
 * @param {string} [args.baseName]
 * @param {string} [args.theirName]
 * @param {boolean} [args.dryRun = false]
 * @param {MergeDriverCallback} [args.mergeDriver]
 *
 */
async function mergeBlobs({
  fs,
  gitdir,
  path,
  ours,
  base,
  theirs,
  ourName,
  theirName,
  baseName,
  dryRun,
  mergeDriver = mergeFile as unknown as MergeDriverCallback,
}: {
  fs: FsClient
  gitdir: string
  path: string
  ours: WalkerEntry
  base: WalkerEntry | null
  theirs: WalkerEntry
  ourName?: string
  theirName?: string
  baseName?: string
  dryRun?: boolean
  mergeDriver?: MergeDriverCallback
}): Promise<{ cleanMerge: boolean; mergeResult: TreeEntry }> {
  const type = 'blob'
  // Compute the new mode.
  // Since there are ONLY two valid blob modes ('100755' and '100644') it boils down to this
  let baseMode = '100755'
  let baseOid = ''
  let baseContent = ''
  if (base && (await base.type()) === 'blob') {
    baseMode = (await base.mode()).toString(8)
    baseOid = await base.oid()
    const baseContentBuffer = await base.content()
    if (baseContentBuffer) {
      baseContent = Buffer.from(baseContentBuffer).toString('utf8')
    }
  }
  const ourMode = (await ours.mode()).toString(8)
  const theirMode = (await theirs.mode()).toString(8)
  const mode = baseMode === ourMode ? theirMode : ourMode
  // The trivial case: nothing to merge except maybe mode
  if ((await ours.oid()) === (await theirs.oid())) {
    return {
      cleanMerge: true,
      mergeResult: { mode: mode.padStart(6, '0'), path, oid: await ours.oid(), type },
    }
  }
  // if only one side made oid changes, return that side's oid
  if ((await ours.oid()) === baseOid) {
    return {
      cleanMerge: true,
      mergeResult: { mode: theirMode.padStart(6, '0'), path, oid: await theirs.oid(), type },
    }
  }
  if ((await theirs.oid()) === baseOid) {
    return {
      cleanMerge: true,
      mergeResult: { mode: ourMode.padStart(6, '0'), path, oid: await ours.oid(), type },
    }
  }
  // if both sides made changes do a merge
  const ourContentBuffer = await ours.content()
  const theirContentBuffer = await theirs.content()
  const ourContent = ourContentBuffer ? Buffer.from(ourContentBuffer).toString('utf8') : ''
  const theirContent = theirContentBuffer ? Buffer.from(theirContentBuffer).toString('utf8') : ''
  const mergeResult = await mergeDriver({
    branches: [baseName || 'base', ourName || 'ours', theirName || 'theirs'],
    contents: [baseContent, ourContent, theirContent],
    path,
  } as MergeDriverParams)
  const { mergedText, cleanMerge } = mergeResult
  const oid = await writeObject({
    fs,
    gitdir,
    type: 'blob',
    object: Buffer.from(mergedText, 'utf8'),
    dryRun,
  })

  return { cleanMerge, mergeResult: { mode: mode.padStart(6, '0'), path, oid, type } }
}

