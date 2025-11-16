import { normalizeFs } from "../utils/normalizeFs.ts"
import { writeObject as writeObjectInternal } from "../git/objects/writeObject.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Write a blob object directly
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {Uint8Array} args.blob - The blob object to write
 *
 * @returns {Promise<string>} Resolves successfully with the SHA-1 object id of the newly written object
 *
 * @example
 * // Manually create a blob.
 * let oid = await git.writeBlob({
 *   fs,
 *   dir: '/tutorial',
 *   blob: new Uint8Array([])
 * })
 *
 * console.log('oid', oid) // should be 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'
 *
 */
export async function writeBlob({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  blob,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  blob: Uint8Array
}): Promise<string> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('blob', blob)

    const fs = normalizeFs(_fs)
    return await writeObjectInternal({
      fs,
      gitdir,
      type: 'blob',
      object: blob,
      format: 'content',
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.writeBlob'
    throw err
  }
}

