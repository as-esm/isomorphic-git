import { InternalError } from '../errors/InternalError.js'
import { iteratePackfiles } from './packfileIterator.js'
import type { FsClient } from '../models/FileSystem.js'

export async function expandOidPacked({
  fs,
  cache,
  gitdir,
  oid: short,
  getExternalRefDelta,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
  getExternalRefDelta?: (oid: string) => Promise<{ type: string; object: Buffer }>
}): Promise<string[]> {
  const results: string[] = []
  await iteratePackfiles({
    fs,
    cache,
    gitdir,
    getExternalRefDelta,
    callback: async (p) => {
      if (p.error) throw new InternalError(p.error)
      // Search through the list of oids in the packfile
      for (const oid of p.offsets.keys()) {
        if (oid.startsWith(short)) results.push(oid)
      }
      return null // Continue iterating
    },
  })
  return results
}

