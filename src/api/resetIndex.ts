import { GitIndexManager } from "../managers/GitIndexManager.ts"
import { GitRefManager } from "../managers/GitRefManager.ts"
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

    const fs = normalizeFs(_fs)

    let oid: string | null
    let workdirOid: string | undefined

    try {
      // Resolve commit
      oid = await GitRefManager.resolve({ fs, gitdir, ref: ref || 'HEAD' })
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
    await GitIndexManager.acquire(
      { fs, gitdir, cache },
      async function (index) {
        index.delete({ filepath })
        if (oid) {
          index.insert({ filepath, stats, oid })
        }
      }
    )
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.reset'
    throw err
  }
}

