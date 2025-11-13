import AsyncLock from 'async-lock'

import { UnmergedPathsError } from '../errors/UnmergedPathsError.js'
import { GitIndex } from "../models/GitIndex.ts"
import { compareStats } from "../utils/compareStats.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import type { FsClient, Stat } from "../models/FileSystem.ts"

let lock: AsyncLock | null = null

const IndexCache = Symbol('IndexCache')

type IndexCacheData = {
  map: Map<string, GitIndex>
  stats: Map<string, Stat | null>
}

/**
 * Creates a cache object to store GitIndex and file stats.
 */
function createCache(): IndexCacheData {
  return {
    map: new Map(),
    stats: new Map(),
  }
}

/**
 * Updates the cached index file by reading the file system and parsing the Git index.
 */
async function updateCachedIndexFile(
  fs: FsClient,
  filepath: string,
  cache: IndexCacheData
): Promise<void> {
  const normalizedFs = normalizeFs(fs)
  const [stat, rawIndexFile] = await Promise.all([
    normalizedFs.lstat(filepath),
    normalizedFs.read(filepath),
  ])

  if (!rawIndexFile) {
    throw new Error('Failed to read index file')
  }

  const index = await GitIndex.from(rawIndexFile as Buffer | Uint8Array)
  // cache the GitIndex object so we don't need to re-read it every time.
  cache.map.set(filepath, index)
  // Save the stat data for the index so we know whether the cached file is stale (modified by an outside process).
  cache.stats.set(filepath, stat as Stat | null)
}

/**
 * Determines whether the cached index file is stale by comparing file stats.
 */
async function isIndexStale(
  fs: FsClient,
  filepath: string,
  cache: IndexCacheData
): Promise<boolean> {
  const savedStats = cache.stats.get(filepath)
  if (savedStats === undefined) return true
  if (savedStats === null) return false

  const normalizedFs = normalizeFs(fs)
  const currStats = await normalizedFs.lstat(filepath)
  if (currStats === null) return false
  return compareStats(savedStats, currStats as Stat)
}

export class GitIndexManager {
  /**
   * Manages access to the Git index file, ensuring thread-safe operations and caching.
   */
  static async acquire<T>({
    fs,
    gitdir,
    cache,
    allowUnmerged = true,
  }: {
    fs: FsClient
    gitdir: string
    cache: Record<string, unknown>
    allowUnmerged?: boolean
  }, closure: (index: GitIndex) => Promise<T> | T): Promise<T> {
    const cacheKey = IndexCache as unknown as string
    if (!cache[cacheKey]) {
      cache[cacheKey] = createCache()
    }

    const filepath = `${gitdir}/index`
    if (lock === null) lock = new AsyncLock({ maxPending: Infinity })
    let result: T
    let unmergedPaths: string[] = []
    await lock.acquire(filepath, async () => {
      // Acquire a file lock while we're reading the index
      // to make sure other processes aren't writing to it
      // simultaneously, which could result in a corrupted index.
      // const fileLock = await Lock(filepath)
      const theIndexCache = cache[cacheKey] as IndexCacheData
      if (await isIndexStale(fs, filepath, theIndexCache)) {
        await updateCachedIndexFile(fs, filepath, theIndexCache)
      }
      const index = theIndexCache.map.get(filepath)
      if (!index) {
        throw new Error('Index not found in cache')
      }
      unmergedPaths = index.unmergedPaths

      if (unmergedPaths.length && !allowUnmerged)
        throw new UnmergedPathsError(unmergedPaths)

      result = await closure(index)
      if ((index as { _dirty?: boolean })._dirty) {
        // Acquire a file lock while we're writing the index file
        // let fileLock = await Lock(filepath)
        const normalizedFs = normalizeFs(fs)
        const buffer = await index.toObject()
        await normalizedFs.write(filepath, buffer)
        // Update cached stat value
        theIndexCache.stats.set(filepath, (await normalizedFs.lstat(filepath)) as Stat | null)
        ;(index as { _dirty?: boolean })._dirty = false
      }
    })

    return result!
  }
}

