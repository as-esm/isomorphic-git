// GitRefManager import removed - using src/git/refs/ functions instead
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { hashObject } from "../utils/hashObject.ts"
import { join } from "../utils/join.ts"
import { resolveFilepath } from "../utils/resolveFilepath.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Reset a file in the git index (aka staging area)
 *
 * Note that this does NOT modify the file in the working directory.
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.filepath - The path to the file to reset in the index
 * @param {string} [args.ref = 'HEAD'] - A ref to the commit to use
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<void>} Resolves successfully once the git index has been updated
 *
 * @example
 * await git.resetIndex({ fs, dir: '/tutorial', filepath: 'README.md' })
 * console.log('done')
 *
 */
export async function resetIndex({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  filepath,
  ref,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  filepath: string
  ref?: string
  cache?: Record<string, unknown>
}): Promise<void> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('filepath', filepath)

    // CRITICAL: Use Repository to ensure consistency with other operations
    const { Repository } = await import('../core-utils/Repository.ts')
    const repo = await Repository.open({ fs: _fs, dir, gitdir, cache, autoDetectConfig: true })
    
    // CRITICAL: Use repo.fs (which is already normalized) for all file operations
    // This ensures we're using the exact same fs instance that the Repository uses
    const fs = repo.fs

    let oid: string | null
    let workdirOid: string | undefined

    try {
      // Resolve commit - use direct resolveRef() for consistency
      const { resolveRef } = await import('../git/refs/readRef.ts')
      oid = await resolveRef({ fs, gitdir, ref: ref || 'HEAD' })
    } catch (e) {
      if (ref) {
        // Only throw the error if a ref is explicitly provided
        throw e
      }
      oid = null
    }

    // Not having an oid at this point means `resetIndex()` was called without explicit `ref` on a new git
    // repository. If that happens, we can skip resolving the file path.
    if (oid) {
      try {
        // Resolve blob
        oid = await resolveFilepath({
          fs,
          cache,
          gitdir,
          oid,
          filepath,
        })
      } catch (e) {
        // This means we're resetting the file to a "deleted" state
        oid = null
      }
    }

    // For files that aren't in the workdir use zeros
    let stats = {
      ctime: new Date(0),
      mtime: new Date(0),
      dev: 0,
      ino: 0,
      mode: 0,
      uid: 0,
      gid: 0,
      size: 0,
    }
    // If the file exists in the workdir...
    const object = dir && (await fs.read(join(dir, filepath)))
    if (object) {
      // ... and has the same hash as the desired state...
      workdirOid = await hashObject({
        gitdir,
        type: 'blob',
        object,
      })
      if (oid === workdirOid) {
        // ... use the workdir Stats object
        stats = await fs.lstat(join(dir, filepath))
      }
    }
    // Use Repository.readIndexDirect() and writeIndexDirect() for consistency
    const index = await repo.readIndexDirect(false) // Force fresh read
    
    index.delete({ filepath })
    if (oid) {
      index.insert({ filepath, stats, oid })
    }
    await repo.writeIndexDirect(index)
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.reset'
    throw err
  }
}

