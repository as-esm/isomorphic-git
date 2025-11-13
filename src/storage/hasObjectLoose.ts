import { normalizeFs } from "../utils/normalizeFs.ts"
import type { FsClient } from "../models/FileSystem.ts"

export async function hasObjectLoose({
  fs,
  gitdir,
  oid,
}: {
  fs: FsClient
  gitdir: string
  oid: string
}): Promise<boolean> {
  const normalizedFs = normalizeFs(fs)
  const source = `objects/${oid.slice(0, 2)}/${oid.slice(2)}`
  return normalizedFs.exists(`${gitdir}/${source}`)
}

