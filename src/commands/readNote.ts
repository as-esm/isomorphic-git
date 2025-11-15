import { resolveRef } from "../git/refs/readRef.ts"

import { _readBlob } from './readBlob.ts'
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Read the contents of a note
 *
 * @param {object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string} [args.ref] - The notes ref to look under
 * @param {string} args.oid
 *
 * @returns {Promise<Uint8Array>} Resolves successfully with note contents as a Buffer.
 */

export async function _readNote({
  fs,
  cache,
  gitdir,
  ref = 'refs/notes/commits',
  oid,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  ref?: string
  oid: string
}): Promise<Uint8Array> {
  const parent = await resolveRef({ fs, gitdir, ref })
  const { blob } = await _readBlob({
    fs,
    cache,
    gitdir,
    oid: parent,
    filepath: oid,
  })

  return blob
}

