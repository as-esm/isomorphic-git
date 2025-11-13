import { collect } from "../utils/collect.ts"
import { join } from "../utils/join.ts"

import { _pack } from './pack.ts'
import type { FsClient } from "../models/FileSystem.ts"

/**
 *
 * @typedef {Object} PackObjectsResult The packObjects command returns an object with two properties:
 * @property {string} filename - The suggested filename for the packfile if you want to save it to disk somewhere. It includes the packfile SHA.
 * @property {Uint8Array} [packfile] - The packfile contents. Not present if `write` parameter was true, in which case the packfile was written straight to disk.
 */

export type PackObjectsResult = {
  filename: string
  packfile?: Uint8Array
}

/**
 * @param {object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string[]} args.oids
 * @param {boolean} args.write
 *
 * @returns {Promise<PackObjectsResult>}
 * @see PackObjectsResult
 */
export async function _packObjects({ fs, cache, gitdir, oids, write }: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oids: string[]
  write: boolean
}): Promise<PackObjectsResult> {
  const buffers = await _pack({ fs, cache, gitdir, oids })
  const packfile = Buffer.from(await collect(buffers))
  const packfileSha = packfile.slice(-20).toString('hex')
  const filename = `pack-${packfileSha}.pack`
  if (write) {
    await fs.write(join(gitdir, `objects/pack/${filename}`), packfile)
    return { filename }
  }
  return {
    filename,
    packfile: new Uint8Array(packfile),
  }
}

