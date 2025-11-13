import { InternalError } from '../errors/InternalError.ts'
import { iteratePackfiles } from './packfileIterator.ts'
import type { FsClient } from "../models/FileSystem.ts"

export type ReadObjectPackedResult = {
  object: Buffer
  type: string
  format: string
  source?: string
  oid?: string
}

export async function readObjectPacked({
  fs,
  cache,
  gitdir,
  oid,
  format = 'content',
  getExternalRefDelta,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
  format?: string
  getExternalRefDelta?: (oid: string) => Promise<{ type: string; object: Buffer }>
}): Promise<ReadObjectPackedResult | null> {
  return iteratePackfiles({
    fs,
    cache,
    gitdir,
    getExternalRefDelta,
    callback: async (p, filename) => {
      if (p.error) throw new InternalError(p.error)
      // If the packfile DOES have the oid we're looking for...
      if (p.offsets.has(oid)) {
        // Get the resolved git object from the packfile
        if (!p.read) {
          return null
        }
        const { normalizeFs } = await import('../utils/normalizeFs.ts')
        const normalizedFs = normalizeFs(fs)
        if (!p.pack) {
          const indexFile = `${gitdir}/objects/pack/${filename}`
          const packFile = indexFile.replace(/idx$/, 'pack')
          const packData = await normalizedFs.read(packFile)
          if (!packData) {
            return null
          }
          p.pack = Promise.resolve(Buffer.isBuffer(packData) ? packData : Buffer.from(packData as string | Uint8Array))
        }
        const readResult = await p.read({ oid })
        const result = readResult as ReadObjectPackedResult
        result.format = 'content'
        result.source = `objects/pack/${filename.replace(/idx$/, 'pack')}`
        return result
      }
      return null
    },
  })
}

