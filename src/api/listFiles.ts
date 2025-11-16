import { _listFiles } from "../commands/listFiles.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * List all the files in the git index or a commit
 *
 * > Note: This function is efficient for listing the files in the staging area, but listing all the files in a commit requires recursively walking through the git object store.
 * > If you do not require a complete list of every file, better performance can be achieved by using [walk](./walk) and ignoring subdirectories you don't care about.
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.ref] - Return a list of all the files in the commit at `ref` instead of the files currently in the git index (aka staging area)
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<Array<string>>} Resolves successfully with an array of filepaths
 *
 * @example
 * // All the files in the previous commit
 * let files = await git.listFiles({ fs, dir: '/tutorial', ref: 'HEAD' })
 * console.log(files)
 * // All the files in the current staging area
 * files = await git.listFiles({ fs, dir: '/tutorial' })
 * console.log(files)
 *
 */
export async function listFiles({
  fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  ref,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  ref?: string
  cache?: Record<string, unknown>
}): Promise<string[]> {
  try {
    assertParameter('fs', fs)
    if (!gitdir) {
      throw new Error('gitdir is required')
    }
    assertParameter('gitdir', gitdir)

    // CRITICAL: Resolve gitdir through Repository to ensure consistency with add()
    // This ensures that add() and listFiles() use the same gitdir path and cache entry
    let effectiveGitdir = gitdir
    try {
      const { Repository } = await import('../core-utils/Repository.ts')
      const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
      effectiveGitdir = await repo.getGitdir()
      // Use the repository's cache to ensure consistency
      // Repository.open uses the provided cache if given, so repo.cache === cache
    } catch {
      // If Repository.open fails, use provided gitdir
      effectiveGitdir = gitdir
    }

    return await _listFiles({
      fs: normalizeFs(fs) as any,
      cache,
      gitdir: effectiveGitdir,
      ref,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.listFiles'
    throw err
  }
}

