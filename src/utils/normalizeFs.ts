import { FileSystem } from "../models/FileSystem.ts"
import type { FsClient } from "../models/FileSystem.ts"

// A WeakMap to cache the FileSystem wrapper for each raw fs object.
// This ensures that the same raw fs object always returns the same FileSystem wrapper instance,
// which is critical for Repository instance caching to work correctly.
const wrapperCache = new WeakMap<object, FileSystem>()

/**
 * Normalizes an FsClient to a FileSystem instance, ensuring that the same
 * raw fs object always returns the same FileSystem wrapper instance.
 * 
 * This is critical for Repository instance caching - if normalizeFs creates
 * a new wrapper for each call, Repository.open() will use different fs objects
 * as cache keys, causing it to create multiple Repository instances for the
 * same repository, breaking state consistency.
 * 
 * @param fs - The filesystem client to normalize
 * @returns A cached or new FileSystem instance
 */
export function normalizeFs(fs: FsClient): FileSystem {
  // If fs is already a FileSystem instance, return it directly
  if (fs instanceof FileSystem) {
    return fs
  }

  // The raw fs object is the true source of identity.
  // If 'fs' is already a FileSystem wrapper, we can use it directly as the key.
  // Otherwise, use the raw fs object as the key.
  const rawFs = (fs as any)._original_unwrapped_fs || fs
  const key = rawFs as object

  // 1. Check if we have already created a wrapper for this raw fs instance.
  if (wrapperCache.has(key)) {
    return wrapperCache.get(key)!
  }

  // 2. If not, create a new wrapper. The FileSystem constructor is smart
  //    and won't re-wrap an existing wrapper.
  const wrapper = new FileSystem(fs as any)

  // 3. Cache the new wrapper against the raw fs object.
  wrapperCache.set(key, wrapper)

  return wrapper
}

