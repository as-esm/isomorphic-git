import { resolveRef } from "../git/refs/readRef.ts"
import { readBlob } from './readBlob.ts'
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Read the contents of a note
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.ref] - The notes ref to look under
 * @param {string} args.oid - The SHA-1 object id of the object to get the note for.
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<Uint8Array>} Resolves successfully with note contents as a Buffer.
 */
export async function readNote({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  ref = 'refs/notes/commits',
  oid,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  ref?: string
  oid: string
  cache?: Record<string, unknown>
}): Promise<Uint8Array> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('ref', ref)
    assertParameter('oid', oid)

    const fs = normalizeFs(_fs)
    const parent = await resolveRef({ fs, gitdir, ref })
    const { blob } = await readBlob({
      fs,
      cache,
      gitdir,
      oid: parent,
      filepath: oid,
    })

    return blob
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.readNote'
    throw err
  }
}

