import { resolveBlob } from "../utils/resolveBlob.ts"
import { resolveFilepath } from "../utils/resolveFilepath.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

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
  fs: _fs,
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
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('oid', oid)

    const fs = normalizeFs(_fs)
    let resolvedOid = oid
    if (filepath !== undefined) {
      resolvedOid = await resolveFilepath({ fs, cache, gitdir, oid, filepath })
    }
    const blob = await resolveBlob({
      fs,
      cache,
      gitdir,
      oid: resolvedOid,
    })
    return blob
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.readBlob'
    throw err
  }
}

