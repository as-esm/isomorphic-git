import { _log } from "../commands/log.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { ReadCommitResult } from "../models/GitCommit.ts"

/**
 * Get commit descriptions from the git history
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string=} args.filepath optional get the commit for the filepath only
 * @param {string} [args.ref = 'HEAD'] - The commit to begin walking backwards through the history from
 * @param {number=} [args.depth] - Limit the number of commits returned. No limit by default.
 * @param {Date} [args.since] - Return history newer than the given date. Can be combined with `depth` to get whichever is shorter.
 * @param {boolean=} [args.force=false] do not throw error if filepath is not exist (works only for a single file). defaults to false
 * @param {boolean=} [args.follow=false] Continue listing the history of a file beyond renames (works only for a single file). defaults to false
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<Array<ReadCommitResult>>} Resolves to an array of ReadCommitResult objects
 * @see ReadCommitResult
 * @see CommitObject
 *
 * @example
 * let commits = await git.log({
 *   fs,
 *   dir: '/tutorial',
 *   depth: 5,
 *   ref: 'main'
 * })
 * console.log(commits)
 *
 */
export async function log({
  fs,
  dir,
  gitdir = join(dir, '.git'),
  filepath,
  ref = 'HEAD',
  depth,
  since,
  force,
  follow,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  filepath?: string
  ref?: string
  depth?: number
  since?: Date
  force?: boolean
  follow?: boolean
  cache?: Record<string, unknown>
}): Promise<ReadCommitResult[]> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir)
    assertParameter('ref', ref)

    return await _log({
      fs: normalizeFs(fs),
      cache,
      gitdir,
      filepath,
      ref,
      depth,
      since,
      force,
      follow,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.log'
    throw err
  }
}

