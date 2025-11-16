import { AmbiguousError } from '../../errors/AmbiguousError.ts'
import { NotFoundError } from '../../errors/NotFoundError.ts'
import { readObject } from './readObject.ts'
import { normalizeFs } from '../../utils/normalizeFs.ts'
import { join } from '../../core-utils/GitPath.ts'
import { GitPackIndex } from '../../models/GitPackIndex.ts'
import { GitMultiPackIndex } from '../../models/GitMultiPackIndex.ts'
import type { FsClient } from "../../models/FileSystem.ts"

const PackfileCache = Symbol('PackfileCache')
const MultiPackIndexCache = Symbol('MultiPackIndexCache')

type GetExternalRefDelta = (oid: string) => Promise<{ type: string; object: Buffer }>

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
  if (!cache[MultiPackIndexCache]) {
    cache[MultiPackIndexCache] = null
  }
  let midx = cache[MultiPackIndexCache] as GitMultiPackIndex | null

  if (!midx) {
    const midxPath = join(gitdir, 'objects', 'info', 'multi-pack-index')
    try {
      const midxData = await fs.read(midxPath)
      const midxBuffer = Buffer.isBuffer(midxData)
        ? midxData
        : Buffer.from(midxData as string | Uint8Array)
      midx = GitMultiPackIndex.fromBuffer(midxBuffer)
      cache[MultiPackIndexCache] = midx
    } catch {
      return null
    }
  }

  return midx
}

/**
 * Expand a short object ID to a full SHA-1, checking both loose and packed objects
 * 
 * @param fs - File system client
 * @param cache - Cache object for packfile indices
 * @param gitdir - Path to .git directory
 * @param oid - Short object ID (prefix)
 * @returns Promise resolving to the full SHA-1, or throwing if ambiguous/not found
 */
export async function expandOid({
  fs,
  cache,
  gitdir,
  oid: short,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
}): Promise<string> {
  // Curry the current read method so that the packfile un-deltification
  // process can acquire external ref-deltas.
  const getExternalRefDelta = async (oid: string): Promise<{ type: string; object: Buffer }> => {
    const result = await readObject({ fs, cache, gitdir, oid })
    return {
      type: result.type || '',
      object: result.object,
    }
  }

  const results: string[] = []

  // Check loose objects
  const normalizedFs = normalizeFs(fs)
  const prefix = short.slice(0, 2)
  try {
    const objectsSuffixes = await normalizedFs.readdir(`${gitdir}/objects/${prefix}`)
    if (objectsSuffixes) {
      const looseOids = objectsSuffixes
        .map(suffix => `${prefix}${suffix}`)
        .filter(_oid => _oid.startsWith(short))
      results.push(...looseOids)
    }
  } catch {
    // Directory doesn't exist, that's okay
  }

  // Check packed objects
  // First, try to use multi-pack-index if it exists
  const midx = await loadMultiPackIndex({ fs, cache, gitdir })
  if (midx) {
    // MIDX has a method to get all OIDs, but we need to iterate through them
    // For now, we'll fall through to the packfile iteration below
  }

  // Iterate through all packfiles
  try {
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

      // Check all OIDs in this packfile index
      for (const oid of p.offsets.keys()) {
        if (oid.startsWith(short) && results.indexOf(oid) === -1) {
          results.push(oid)
        }
      }
    }
  } catch {
    // No packfiles or error reading them, that's okay
  }

  if (results.length === 1) {
    return results[0]
  }
  if (results.length > 1) {
    throw new AmbiguousError('oids', short, results)
  }
  throw new NotFoundError(`an object matching "${short}"`)
}

