import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Remove a file from the git index (aka staging area)
 *
 * Note that this does NOT delete the file in the working directory.
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.filepath - The path to the file to remove from the index
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<void>} Resolves successfully once the git index has been updated
 *
 * @example
 * await git.remove({ fs, dir: '/tutorial', filepath: 'README.md' })
 * console.log('done')
 *
 */
export async function remove({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  filepath,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  filepath: string
  cache?: Record<string, unknown>
}): Promise<void> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('filepath', filepath)

    // CRITICAL: Resolve gitdir through Repository to ensure consistency with add() and listFiles()
    // This ensures that add(), remove(), and listFiles() use the same gitdir path and cache entry
    let effectiveGitdir = gitdir
    try {
      const { Repository } = await import('../core-utils/Repository.ts')
      const repo = await Repository.open({ fs: _fs, dir, cache, autoDetectConfig: true })
      effectiveGitdir = await repo.getGitdir()
      // Use the repository's cache to ensure consistency
      // Repository.open uses the provided cache if given, so repo.cache === cache
    } catch {
      // If Repository.open fails, use provided gitdir
      effectiveGitdir = gitdir
    }

    // Use Repository.readIndexDirect() and writeIndexDirect() for consistency
    const { Repository } = await import('../core-utils/Repository.ts')
    const repo = await Repository.open({ fs: _fs, dir, cache, autoDetectConfig: true })
    const index = await repo.readIndexDirect(false) // Force fresh read
    index.delete({ filepath })
    await repo.writeIndexDirect(index)
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.remove'
    throw err
  }
}

