import { normalizeFs } from "../utils/normalizeFs.ts"
import type { FsClient } from "../models/FileSystem.ts"

export async function expandOidLoose({
  fs,
  gitdir,
  oid: short,
}: {
  fs: FsClient
  gitdir: string
  oid: string
}): Promise<string[]> {
  const normalizedFs = normalizeFs(fs)
  const prefix = short.slice(0, 2)
  const objectsSuffixes = await normalizedFs.readdir(`${gitdir}/objects/${prefix}`)
  if (!objectsSuffixes) {
    return []
  }
  return objectsSuffixes
    .map(suffix => `${prefix}${suffix}`)
    .filter(_oid => _oid.startsWith(short))
}

