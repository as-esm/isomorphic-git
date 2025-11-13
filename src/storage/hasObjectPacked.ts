import { InternalError } from '../errors/InternalError.ts'
import { iteratePackfiles } from './packfileIterator.ts'
import type { FsClient } from "../models/FileSystem.ts"

export async function hasObjectPacked({
  fs,
  cache,
  gitdir,
  oid,
  getExternalRefDelta,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
  getExternalRefDelta?: (oid: string) => Promise<{ type: string; object: Buffer }>
}): Promise<boolean> {
  const result = await iteratePackfiles({
    fs,
    cache,
    gitdir,
    getExternalRefDelta,
    callback: async (p) => {
      if (p.error) throw new InternalError(p.error)
      // If the packfile DOES have the oid we're looking for...
      if (p.offsets.has(oid)) {
        return true
      }
      return null
    },
  })
  return result === true
}

