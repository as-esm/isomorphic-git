import { normalizeFs } from '../utils/normalizeFs.js'
import type { FsClient } from '../models/FileSystem.js'

export type ReadObjectLooseResult = {
  object: Buffer
  format: 'deflated'
  source: string
}

export async function readObjectLoose({
  fs,
  gitdir,
  oid,
}: {
  fs: FsClient
  gitdir: string
  oid: string
}): Promise<ReadObjectLooseResult | null> {
  const normalizedFs = normalizeFs(fs)
  const source = `objects/${oid.slice(0, 2)}/${oid.slice(2)}`
  const file = await normalizedFs.read(`${gitdir}/${source}`)
  if (!file) {
    return null
  }
  const fileBuffer = Buffer.isBuffer(file) ? file : Buffer.from(file as string | Uint8Array)
  return { object: fileBuffer, format: 'deflated', source }
}

