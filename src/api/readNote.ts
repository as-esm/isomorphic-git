import { _readNote } from "../commands/readNote.js"
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
  fs,
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
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir)
    assertParameter('ref', ref)
    assertParameter('oid', oid)

    return await _readNote({
      fs: normalizeFs(fs),
      cache,
      gitdir,
      ref,
      oid,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.readNote'
    throw err
  }
}

