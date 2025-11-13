import { GitPackIndex } from "../models/GitPackIndex.ts"
import type { FsClient } from "../models/FileSystem.ts"

const PackfileCache = Symbol('PackfileCache')

import { normalizeFs } from "../utils/normalizeFs.ts"

async function loadPackIndex({
  fs,
  filename,
  getExternalRefDelta,
}: {
  fs: FsClient
  filename: string
  getExternalRefDelta?: (oid: string) => Promise<{ type: string; object: Buffer }>
}): Promise<GitPackIndex | undefined> {
  const normalizedFs = normalizeFs(fs)
  const idx = await normalizedFs.read(filename)
  if (!idx) {
    return undefined
  }
  const idxBuffer = Buffer.isBuffer(idx) ? idx : Buffer.from(idx as string | Uint8Array)
  return GitPackIndex.fromIdx({ idx: idxBuffer, getExternalRefDelta })
}

export function readPackIndex({
  fs,
  cache,
  filename,
  getExternalRefDelta,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  filename: string
  getExternalRefDelta?: (oid: string) => Promise<{ type: string; object: Buffer }>
}): Promise<GitPackIndex | undefined> {
  // Try to get the packfile index from the in-memory cache
  const cacheKey = PackfileCache as unknown as string
  if (!cache[cacheKey]) {
    cache[cacheKey] = new Map<string, Promise<GitPackIndex | undefined>>()
  }
  const packfileCache = cache[cacheKey] as Map<string, Promise<GitPackIndex | undefined>>
  let p = packfileCache.get(filename)
  if (!p) {
    p = loadPackIndex({
      fs,
      filename,
      getExternalRefDelta,
    })
    packfileCache.set(filename, p)
  }
  return p
}

