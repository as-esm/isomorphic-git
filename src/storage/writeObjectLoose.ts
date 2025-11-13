import { InternalError } from '../errors/InternalError.ts'
import { normalizeFs } from "../utils/normalizeFs.ts"
import type { FsClient } from "../models/FileSystem.ts"

export async function writeObjectLoose({
  fs,
  gitdir,
  object,
  format,
  oid,
}: {
  fs: FsClient
  gitdir: string
  object: Buffer | Uint8Array
  format: 'deflated'
  oid: string
}): Promise<void> {
  if (format !== 'deflated') {
    throw new InternalError(
      'GitObjectStoreLoose expects objects to write to be in deflated format'
    )
  }
  const normalizedFs = normalizeFs(fs)
  const source = `objects/${oid.slice(0, 2)}/${oid.slice(2)}`
  const filepath = `${gitdir}/${source}`
  // Don't overwrite existing git objects - this helps avoid EPERM errors.
  // Although I don't know how we'd fix corrupted objects then. Perhaps delete them
  // on read?
  if (!(await normalizedFs.exists(filepath))) {
    const objectBuffer = Buffer.isBuffer(object) ? object : Buffer.from(object)
    await normalizedFs.write(filepath, objectBuffer)
  }
}

