import { readPackIndex } from './readPackIndex.ts'
import { join } from "../utils/join.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { GitPackIndex } from "../models/GitPackIndex.ts"

/**
 * Generic packfile iterator that reduces redundancy across
 * readObjectPacked, hasObjectPacked, and expandOidPacked
 */
export async function iteratePackfiles<T>({
  fs,
  cache,
  gitdir,
  getExternalRefDelta,
  callback,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  getExternalRefDelta?: (oid: string) => Promise<{ type: string; object: Buffer }>
  callback: (pack: { offsets: Map<string, number>; read?: (params: { oid: string }) => Promise<unknown>; pack?: Promise<Buffer | Uint8Array>; error?: string }, filename: string) => Promise<T | null>
}): Promise<T | null> {
  const normalizedFs = normalizeFs(fs)
  let list = await normalizedFs.readdir(join(gitdir, 'objects/pack'))
  if (!list) {
    return null
  }
  list = list.filter(x => x.endsWith('.idx'))
  
  for (const filename of list) {
    const indexFile = `${gitdir}/objects/pack/${filename}`
    const p = await readPackIndex({
      fs,
      cache,
      filename: indexFile,
      getExternalRefDelta,
    })
    
    if (!p) {
      continue
    }
    
    const packData = {
      offsets: p.offsets,
      read: p.read ? p.read.bind(p) : undefined,
      pack: p.pack as Promise<Buffer | Uint8Array> | undefined,
    }
    
    const result = await callback(packData, filename)
    if (result !== null) {
      return result
    }
  }
  
  return null
}

