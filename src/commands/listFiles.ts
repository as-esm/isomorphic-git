import { readTree } from './readTree.ts'
// GitRefManager import removed - using src/git/refs/ functions instead
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
  fs: _fs,
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
    assertParameter('fs', _fs)
    if (!gitdir) {
      throw new Error('gitdir is required')
    }
    assertParameter('gitdir', gitdir)

    const fs = normalizeFs(_fs)

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
      fs: fs as any,
      cache,
      gitdir: effectiveGitdir,
      ref,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.listFiles'
    throw err
  }
}

/**
 * Internal listFiles implementation
 * @internal - Exported for use by other commands
 */
export async function _listFiles({
  fs,
  gitdir,
  ref,
  cache,
}: {
  fs: FsClient
  gitdir: string
  ref?: string
  cache: Record<string, unknown>
}): Promise<string[]> {
  if (ref) {
    // Use direct resolveRef() for consistency
    const { resolveRef } = await import('../git/refs/readRef.ts')
    const oid = await resolveRef({ fs, gitdir, ref })
    const filenames: string[] = []
    await accumulateFilesFromOid({
      fs,
      cache,
      gitdir,
      oid,
      filenames,
      prefix: '',
    })
    return filenames
  } else {
    // Use Repository.readIndexDirect() for consistency
    const { Repository } = await import('../core-utils/Repository.ts')
    // When dir is undefined, gitdir must be provided
    if (!gitdir) {
      throw new Error('Either dir or gitdir is required for listFiles')
    }
    const repo = await Repository.open({ fs, dir: undefined, gitdir, cache, autoDetectConfig: true })
    const index = await repo.readIndexDirect(false) // Force fresh read
    // Filter out entries without paths and return sorted list
    // This handles edge cases where entries might not have paths set
    return index.entries
      .map(x => x.path)
      .filter((path): path is string => path !== undefined && path !== null && path !== '')
  }
}

async function accumulateFilesFromOid({
  fs,
  cache,
  gitdir,
  oid,
  filenames,
  prefix,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
  filenames: string[]
  prefix: string
}): Promise<void> {
  const { tree } = await readTree({ fs, cache, gitdir, oid })
  // TODO: Use `walk` to do this. Should be faster.
  for (const entry of tree) {
    if (entry.type === 'tree') {
      await accumulateFilesFromOid({
        fs,
        cache,
        gitdir,
        oid: entry.oid,
        filenames,
        prefix: join(prefix, entry.path),
      })
    } else {
      filenames.push(join(prefix, entry.path))
    }
  }
}

