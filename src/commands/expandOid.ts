import { normalizeFs } from "../utils/normalizeFs.ts"
import { expandOid as expandOidInternal } from "../git/objects/expandOid.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Expand and resolve a short oid into a full oid
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.oid - The shortened oid prefix to expand (like "0414d2a")
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<string>} Resolves successfully with the full oid (like "0414d2a286d7bbc7a4a326a61c1f9f888a8ab87f")
 *
 * @example
 * let oid = await git.expandOid({ fs, dir: '/tutorial', oid: '0414d2a'})
 * console.log(oid)
 *
 */
export async function expandOid({
  fs: _fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  oid,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  oid: string
  cache?: Record<string, unknown>
}): Promise<string> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir!)
    assertParameter('oid', oid)
    const fs = normalizeFs(_fs)
    return await expandOidInternal({
      fs: fs as any,
      cache,
      gitdir: gitdir!,
      oid,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.expandOid'
    throw err
  }
}

