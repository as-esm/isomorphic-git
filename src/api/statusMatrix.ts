import { STAGE } from '../commands/STAGE.ts'
import { TREE } from '../commands/TREE.ts'
import { WORKDIR } from '../commands/WORKDIR.ts'
import { _walk } from '../commands/walk.ts'
import { isIgnored as isIgnoredInternal } from "../git/info/isIgnored.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { worthWalking } from "../utils/worthWalking.ts"
import type { FsClient } from "../models/FileSystem.ts"

// ============================================================================
// STATUS TYPES
// ============================================================================

/**
 * Head status (0 = absent, 1 = present)
 */
export type HeadStatus = 0 | 1

/**
 * Working directory status (0 = absent, 1 = present, 2 = modified)
 */
export type WorkdirStatus = 0 | 1 | 2

/**
 * Staging area status (0 = absent, 1 = present, 2 = modified, 3 = both modified)
 */
export type StageStatus = 0 | 1 | 2 | 3

/**
 * Status matrix row: [filepath, headStatus, workdirStatus, stageStatus]
 */
export type StatusRow = [string, HeadStatus, WorkdirStatus, StageStatus]

/**
 * Efficiently get the status of multiple files at once.
 *
 * The returned `StatusMatrix` is admittedly not the easiest format to read.
 * However it conveys a large amount of information in dense format that should make it easy to create reports about the current state of the repository;
 * without having to do multiple, time-consuming isomorphic-git calls.
 * My hope is that the speed and flexibility of the function will make up for the learning curve of interpreting the return value.
 *
 * ```js live
 * // get the status of all the files in 'src'
 * let status = await git.statusMatrix({
 *   fs,
 *   dir: '/tutorial',
 *   filter: f => f.startsWith('src/')
 * })
 * console.log(status)
 * ```
 *
 * ```js live
 * // get the status of all the JSON and Markdown files
 * let status = await git.statusMatrix({
 *   fs,
 *   dir: '/tutorial',
 *   filter: f => f.endsWith('.json') || f.endsWith('.md')
 * })
 * console.log(status)
 * ```
 *
 * The result is returned as a 2D array.
 * The outer array represents the files and/or blobs in the repo, in alphabetical order.
 * The inner arrays describe the status of the file:
 * the first value is the filepath, and the next three are integers
 * representing the HEAD status, WORKDIR status, and STAGE status of the entry.
 *
 * ```js
 * // example StatusMatrix
 * [
 *   ["a.txt", 0, 2, 0], // new, untracked
 *   ["b.txt", 0, 2, 2], // added, staged
 *   ["c.txt", 0, 2, 3], // added, staged, with unstaged changes
 *   ["d.txt", 1, 1, 1], // unmodified
 *   ["e.txt", 1, 2, 1], // modified, unstaged
 *   ["f.txt", 1, 2, 2], // modified, staged
 *   ["g.txt", 1, 2, 3], // modified, staged, with unstaged changes
 *   ["h.txt", 1, 0, 1], // deleted, unstaged
 *   ["i.txt", 1, 0, 0], // deleted, staged
 *   ["j.txt", 1, 2, 0], // deleted, staged, with unstaged-modified changes (new file of the same name)
 *   ["k.txt", 1, 1, 0], // deleted, staged, with unstaged changes (new file of the same name)
 * ]
 * ```
 *
 * - The HEAD status is either absent (0) or present (1).
 * - The WORKDIR status is either absent (0), identical to HEAD (1), or different from HEAD (2).
 * - The STAGE status is either absent (0), identical to HEAD (1), identical to WORKDIR (2), or different from WORKDIR (3).
 *
 * ```ts
 * type Filename      = string
 * type HeadStatus    = 0 | 1
 * type WorkdirStatus = 0 | 1 | 2
 * type StageStatus   = 0 | 1 | 2 | 3
 *
 * type StatusRow     = [Filename, HeadStatus, WorkdirStatus, StageStatus]
 *
 * type StatusMatrix  = StatusRow[]
 * ```
 *
 * > Think of the natural progression of file modifications as being from HEAD (previous) -> WORKDIR (current) -> STAGE (next).
 * > Then HEAD is "version 1", WORKDIR is "version 2", and STAGE is "version 3".
 * > Then, imagine a "version 0" which is before the file was created.
 * > Then the status value in each column corresponds to the oldest version of the file it is identical to.
 * > (For a file to be identical to "version 0" means the file is deleted.)
 *
 * Here are some examples of queries you can answer using the result:
 *
 * #### Q: What files have been deleted?
 * ```js
 * const FILE = 0, WORKDIR = 2
 *
 * const filenames = (await statusMatrix({ dir }))
 *   .filter(row => row[WORKDIR] === 0)
 *   .map(row => row[FILE])
 * ```
 *
 * #### Q: What files have unstaged changes?
 * ```js
 * const FILE = 0, WORKDIR = 2, STAGE = 3
 *
 * const filenames = (await statusMatrix({ dir }))
 *   .filter(row => row[WORKDIR] !== row[STAGE])
 *   .map(row => row[FILE])
 * ```
 *
 * #### Q: What files have been modified since the last commit?
 * ```js
 * const FILE = 0, HEAD = 1, WORKDIR = 2
 *
 * const filenames = (await statusMatrix({ dir }))
 *   .filter(row => row[HEAD] !== row[WORKDIR])
 *   .map(row => row[FILE])
 * ```
 *
 * #### Q: What files will NOT be changed if I commit right now?
 * ```js
 * const FILE = 0, HEAD = 1, STAGE = 3
 *
 * const filenames = (await statusMatrix({ dir }))
 *   .filter(row => row[HEAD] === row[STAGE])
 *   .map(row => row[FILE])
 * ```
 *
 * For reference, here are all possible combinations:
 *
 * | HEAD | WORKDIR | STAGE | `git status --short` equivalent |
 * | ---- | ------- | ----- | ------------------------------- |
 * | 0    | 0       | 0     | ``                              |
 * | 0    | 0       | 3     | `AD`                            |
 * | 0    | 2       | 0     | `??`                            |
 * | 0    | 2       | 2     | `A `                            |
 * | 0    | 2       | 3     | `AM`                            |
 * | 1    | 0       | 0     | `D `                            |
 * | 1    | 0       | 1     | ` D`                            |
 * | 1    | 0       | 3     | `MD`                            |
 * | 1    | 1       | 0     | `D ` + `??`                     |
 * | 1    | 1       | 1     | ``                              |
 * | 1    | 1       | 3     | `MM`                            |
 * | 1    | 2       | 0     | `D ` + `??`                     |
 * | 1    | 2       | 1     | ` M`                            |
 * | 1    | 2       | 2     | `M `                            |
 * | 1    | 2       | 3     | `MM`                            |
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.ref = 'HEAD'] - Optionally specify a different commit to compare against the workdir and stage instead of the HEAD
 * @param {string[]} [args.filepaths = ['.']] - Limit the query to the given files and directories
 * @param {function(string): boolean} [args.filter] - Filter the results to only those whose filepath matches a function.
 * @param {object} [args.cache] - a [cache](cache.md) object
 * @param {boolean} [args.ignored = false] - include ignored files in the result
 *
 * @returns {Promise<Array<StatusRow>>} Resolves with a status matrix, described below.
 * @see StatusRow
 */
export async function statusMatrix({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  ref = 'HEAD',
  filepaths = ['.'],
  filter,
  cache = {},
  ignored: shouldIgnore = false,
}: {
  fs: FsClient
  dir: string
  gitdir?: string
  ref?: string
  filepaths?: string[]
  filter?: (filepath: string) => boolean
  cache?: Record<string, unknown>
  ignored?: boolean
}): Promise<StatusRow[]> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('ref', ref)

    // CRITICAL: Get the Repository instance ONCE and pass it to _walk
    // This ensures all walkers (STAGE, TREE, WORKDIR) use the same Repository instance
    // and see the same index state as add(), status(), etc.
    // IMPORTANT: Pass gitdir to Repository.open() to ensure we get the same instance as add()
    const { Repository } = await import('../core-utils/Repository.ts')
    const repo = await Repository.open({ fs: _fs, dir, gitdir, cache, autoDetectConfig: true })
    
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
    
    // Capture fs and dir for use in map function
    const fs = repo.fs
    const effectiveDir = dir
    
    return await _walk({
      repo,
      trees: [TREE({ ref }), WORKDIR(), STAGE()],
      map: async function (filepath: string, [head, workdir, stage]: any[]) {
        // Ignore ignored files, but only if they are not already tracked.
        if (!head && !stage && workdir) {
          if (!shouldIgnore) {
            const isIgnored = await isIgnoredInternal({
              fs,
              dir: effectiveDir,
              filepath,
            })
            if (isIgnored) {
              return null
            }
          }
        }
        // match against base paths
        if (!filepaths.some(base => worthWalking(filepath, base))) {
          return null
        }
        // Late filter against file names
        if (filter) {
          if (!filter(filepath)) return
        }

        const [headType, workdirType, stageType] = await Promise.all([
          head && head.type(),
          workdir && workdir.type(),
          stage && stage.type(),
        ])

        const isBlob = [headType, workdirType, stageType].includes('blob')

        // For now, bail on directories unless the file is also a blob in another tree
        if ((headType === 'tree' || headType === 'special') && !isBlob) return
        if (headType === 'commit') return null

        if ((workdirType === 'tree' || workdirType === 'special') && !isBlob)
          return

        if (stageType === 'commit') return null
        if ((stageType === 'tree' || stageType === 'special') && !isBlob) return

        // Match native git behavior: Files that are only in index (stage) but not in HEAD or workdir
        // should be shown with status [0, 0, 3]. However, if a file is in the index but the corresponding
        // blob object doesn't exist in the object database, we should filter it out as it's invalid.
        // This can happen when the index has stale entries from previous operations.
        // Native git would show these files, but if the blob is missing, it's a repository integrity issue.
        // For now, we show all files that are in stage, matching native git's behavior.
        // The test fixture issue (extra files) should be handled by ensuring clean state in tests.

        // Figure out the oids for files, using the staged oid for the working dir oid if the stats match.
        let headOid: string | undefined
        let stageOid: string | undefined
        let workdirOid: string | undefined
        
        try {
          headOid = headType === 'blob' ? await head.oid() : undefined
        } catch {
          // If we can't get head oid, treat as absent
          headOid = undefined
        }
        
        try {
          stageOid = stageType === 'blob' ? await stage.oid() : undefined
        } catch {
          // If we can't get stage oid (e.g., blob object doesn't exist), filter out this entry
          // This handles cases where the index has stale entries pointing to non-existent blobs
          // Matching native git: if the blob object is missing, the entry is invalid
          return null
        }
        
        if (
          headType !== 'blob' &&
          workdirType === 'blob' &&
          stageType !== 'blob'
        ) {
          // We don't actually NEED the sha. Any sha will do
          // TODO: update this logic to handle N trees instead of just 3.
          workdirOid = '42'
        } else if (workdirType === 'blob') {
          try {
            workdirOid = await workdir.oid()
          } catch {
            // If we can't get workdir oid, treat as absent
            workdirOid = undefined
          }
        }
        
        const entry = [undefined, headOid, workdirOid, stageOid]
        const result = entry.map(value => entry.indexOf(value))
        result.shift() // remove leading undefined entry
        return [filepath, ...result] as StatusRow
      },
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.statusMatrix'
    throw err
  }
}

