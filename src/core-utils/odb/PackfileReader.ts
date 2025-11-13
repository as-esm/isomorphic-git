import { GitPackIndex } from '../../models/GitPackIndex.js'
import { GitMultiPackIndex } from '../../models/GitMultiPackIndex.js'
import { join } from '../GitPath.js'
import type { FsClient } from '../../models/FileSystem.js'
import type { ProgressCallback } from '../../managers/GitRemoteHTTP.js'

const PackfileCache = Symbol('PackfileCache')
const MultiPackIndexCache = Symbol('MultiPackIndexCache')

type ReadResult = {
  type: string
  object: Buffer
  format: string
  source: string
}

type ObjectFormat = 'deflated' | 'wrapped' | 'content'

type GetExternalRefDelta = (oid: string) => Promise<ReadResult>

/**
 * Loads a packfile index from disk or cache
 */
const loadIndex = async ({
  fs,
  cache,
  filename,
  getExternalRefDelta,
}: {
  fs: FsClient
  cache: Record<string | symbol, unknown>
  filename: string
  getExternalRefDelta: GetExternalRefDelta
}): Promise<GitPackIndex> => {
  // Try to get the packfile index from the in-memory cache
  if (!cache[PackfileCache]) cache[PackfileCache] = new Map()
  const cacheMap = cache[PackfileCache] as Map<string, GitPackIndex>
  let p = cacheMap.get(filename)
  if (!p) {
    const idx = await fs.read(filename)
    const idxBuffer = Buffer.isBuffer(idx) ? idx : Buffer.from(idx as string | Uint8Array)
    p = GitPackIndex.fromIdx({ idx: idxBuffer, getExternalRefDelta })
    cacheMap.set(filename, p)
  }
  return p
}

/**
 * Loads the multi-pack-index from disk or cache
 */
const loadMultiPackIndex = async ({
  fs,
  cache,
  gitdir,
}: {
  fs: FsClient
  cache: Record<string | symbol, unknown>
  gitdir: string
}): Promise<GitMultiPackIndex | null> => {
  // Try to get from cache
  if (!cache[MultiPackIndexCache]) {
    cache[MultiPackIndexCache] = null
  }
  let midx = cache[MultiPackIndexCache] as GitMultiPackIndex | null

  if (!midx) {
    // Try to read MIDX file
    const midxPath = join(gitdir, 'objects', 'info', 'multi-pack-index')
    try {
      const midxData = await fs.read(midxPath)
      const midxBuffer = Buffer.isBuffer(midxData)
        ? midxData
        : Buffer.from(midxData as string | Uint8Array)
      midx = GitMultiPackIndex.fromBuffer(midxBuffer)
      cache[MultiPackIndexCache] = midx
    } catch {
      // MIDX doesn't exist, that's okay
      return null
    }
  }

  return midx
}

/**
 * Loads a packfile index from a packfile (creates index on-the-fly)
 */
export const loadIndexFromPack = async ({
  pack,
  getExternalRefDelta,
  onProgress,
}: {
  pack: Buffer | Uint8Array
  getExternalRefDelta: GetExternalRefDelta
  onProgress?: ProgressCallback
}): Promise<GitPackIndex> => {
  const packBuffer = Buffer.isBuffer(pack) ? pack : Buffer.from(pack)
  return GitPackIndex.fromPack({ pack: packBuffer, getExternalRefDelta, onProgress })
}

/**
 * Reads an object from a packfile
 */
export const read = async ({
  fs,
  cache,
  gitdir,
  oid,
  format = 'content',
  getExternalRefDelta,
}: {
  fs: FsClient
  cache: Record<string | symbol, unknown>
  gitdir: string
  oid: string
  format?: ObjectFormat
  getExternalRefDelta: GetExternalRefDelta
}): Promise<ReadResult | null> => {
  // First, try to use multi-pack-index if it exists
  const midx = await loadMultiPackIndex({ fs, cache, gitdir })
  if (midx) {
    const lookup = midx.lookup(oid)
    if (lookup) {
      // Found in MIDX! Use the packfile index to get the packfile name
      const packfileName = midx.getPackfileName(lookup.packfileIndex)
      if (packfileName) {
        const packfilePath = join(gitdir, 'objects', 'pack', packfileName)
        const indexFile = packfilePath.replace(/\.pack$/, '.idx')
        const p = await loadIndex({
          fs,
          cache,
          filename: indexFile,
          getExternalRefDelta,
        })

        if (p) {
          // Get the resolved git object from the packfile
          if (!p.pack) {
            p.pack = fs.read(packfilePath) as Promise<Buffer>
          }

          // Use the offset from MIDX to read the object
          // Note: MIDX gives us the offset, but we need to use the pack index's read method
          // which expects an OID. We'll use the OID lookup instead.
          const result = await p.read({ oid, getExternalRefDelta })
          result.format = format === 'content' ? 'content' : 'wrapped'
          result.source = `objects/pack/${packfileName}`
          return result
        }
      }
    }
  }

  // Fall back to iterating through all .idx files if MIDX doesn't exist or OID not found
  let list = await fs.readdir(join(gitdir, 'objects/pack'))
  list = (list as string[]).filter(x => x.endsWith('.idx'))

  for (const filename of list) {
    const indexFile = `${gitdir}/objects/pack/${filename}`
    const p = await loadIndex({
      fs,
      cache,
      filename: indexFile,
      getExternalRefDelta,
    })

    if (!p) continue

    // If the packfile DOES have the oid we're looking for...
    if (p.offsets.has(oid)) {
      // Get the resolved git object from the packfile
      if (!p.pack) {
        const packFile = indexFile.replace(/idx$/, 'pack')
        p.pack = fs.read(packFile) as Promise<Buffer>
      }

      const result = await p.read({ oid, getExternalRefDelta })
      result.format = format === 'content' ? 'content' : 'wrapped'
      result.source = `objects/pack/${filename.replace(/idx$/, 'pack')}`
      return result
    }
  }

  // Failed to find it
  return null
}

/**
 * Finds which packfile contains a given OID
 */
export const findPackfile = async ({
  fs,
  cache,
  gitdir,
  oid,
  getExternalRefDelta,
}: {
  fs: FsClient
  cache: Record<string | symbol, unknown>
  gitdir: string
  oid: string
  getExternalRefDelta: GetExternalRefDelta
}): Promise<{ index: GitPackIndex; filename: string } | null> => {
  // First, try to use multi-pack-index if it exists
  const midx = await loadMultiPackIndex({ fs, cache, gitdir })
  if (midx) {
    const lookup = midx.lookup(oid)
    if (lookup) {
      // Found in MIDX! Get the packfile name and load its index
      const packfileName = midx.getPackfileName(lookup.packfileIndex)
      if (packfileName) {
        const packfilePath = join(gitdir, 'objects', 'pack', packfileName)
        const indexFile = packfilePath.replace(/\.pack$/, '.idx')
        const p = await loadIndex({
          fs,
          cache,
          filename: indexFile,
          getExternalRefDelta,
        })

        if (p && p.offsets.has(oid)) {
          return { index: p, filename: indexFile }
        }
      }
    }
  }

  // Fall back to iterating through all .idx files
  let list = await fs.readdir(join(gitdir, 'objects/pack'))
  list = (list as string[]).filter(x => x.endsWith('.idx'))

  for (const filename of list) {
    const indexFile = `${gitdir}/objects/pack/${filename}`
    const p = await loadIndex({
      fs,
      cache,
      filename: indexFile,
      getExternalRefDelta,
    })

    if (!p) continue

    if (p.offsets.has(oid)) {
      return { index: p, filename: indexFile }
    }
  }

  return null
}
