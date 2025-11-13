import { _readBlob } from '../commands/readBlob.js'
import { normalizeFs } from '../utils/normalizeFs.js'
import { assertParameter } from '../utils/assertParameter.js'
import { join } from '../utils/join.js'
import type { FsClient } from '../models/FileSystem.js'

// ============================================================================
// READ BLOB TYPES
// ============================================================================

/**
 * Result of reading a blob object
 */
export type ReadBlobResult = {
  oid: string
  blob: Uint8Array
}

/**
 * Read a blob object directly
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.oid - The SHA-1 object id to get. Annotated tags, commits, and trees are peeled.
 * @param {string} [args.filepath] - Don't return the object with `oid` itself, but resolve `oid` to a tree and then return the blob object at that filepath.
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<ReadBlobResult>} Resolves successfully with a blob object description
 * @see ReadBlobResult
 *
 * @example
 * // Get the contents of 'README.md' in the main branch.
 * let commitOid = await git.resolveRef({ fs, dir: '/tutorial', ref: 'main' })
 * console.log(commitOid)
 * let { blob } = await git.readBlob({
 *   fs,
 *   dir: '/tutorial',
 *   oid: commitOid,
 *   filepath: 'README.md'
 * })
 * console.log(Buffer.from(blob).toString('utf8'))
 *
 */
export async function readBlob({
  fs,
  dir,
  gitdir = join(dir, '.git'),
  oid,
  filepath,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  oid: string
  filepath?: string
  cache?: Record<string, unknown>
}): Promise<ReadBlobResult> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir)
    assertParameter('oid', oid)

    return await _readBlob({
      fs: normalizeFs(fs),
      cache,
      gitdir,
      oid,
      filepath,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.readBlob'
    throw err
  }
}

