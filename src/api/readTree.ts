import { _readTree } from "../commands/readTree.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { ReadTreeResult } from "../models/GitTree.ts"

/**
 * Read a tree object directly
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.oid - The SHA-1 object id to get. Annotated tags and commits are peeled.
 * @param {string} [args.filepath] - Don't return the object with `oid` itself, but resolve `oid` to a tree and then return the tree object at that filepath.
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<ReadTreeResult>} Resolves successfully with a git tree object
 * @see ReadTreeResult
 * @see TreeObject
 * @see TreeEntry
 *
 */
export async function readTree({
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
}): Promise<ReadTreeResult> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir)
    assertParameter('oid', oid)

    return await _readTree({
      fs: normalizeFs(fs),
      cache,
      gitdir,
      oid,
      filepath,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.readTree'
    throw err
  }
}

