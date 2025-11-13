import { _packObjects } from '../commands/packObjects.ts'
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * The packObjects command returns an object with two properties:
 */
export type PackObjectsResult = {
  /** The suggested filename for the packfile if you want to save it to disk somewhere. It includes the packfile SHA. */
  filename: string
  /** The packfile contents. Not present if `write` parameter was true, in which case the packfile was written straight to disk. */
  packfile?: Uint8Array
}

/**
 * Create a packfile from an array of SHA-1 object ids
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string[]} args.oids - An array of SHA-1 object ids to be included in the packfile
 * @param {boolean} [args.write = false] - Whether to save the packfile to disk or not
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<PackObjectsResult>} Resolves successfully when the packfile is ready with the filename and buffer
 * @see PackObjectsResult
 *
 * @example
 * // Create a packfile containing only an empty tree
 * let { packfile } = await git.packObjects({
 *   fs,
 *   dir: '/tutorial',
 *   oids: ['4b825dc642cb6eb9a060e54bf8d69288fbee4904']
 * })
 * console.log(packfile)
 *
 */
export async function packObjects({
  fs,
  dir,
  gitdir = join(dir, '.git'),
  oids,
  write = false,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  oids: string[]
  write?: boolean
  cache?: Record<string, unknown>
}): Promise<PackObjectsResult> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir)
    assertParameter('oids', oids)

    return await _packObjects({
      fs: normalizeFs(fs),
      cache,
      gitdir,
      oids,
      write,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.packObjects'
    throw err
  }
}

