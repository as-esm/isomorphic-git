import { FileSystem } from '../models/FileSystem.js'
import type { FsClient } from '../models/FileSystem.js'

/**
 * Normalizes an FsClient to a FileSystem instance.
 * If the FsClient is already a FileSystem instance, returns it directly.
 * Otherwise, wraps it in a new FileSystem instance.
 * 
 * This function prevents redundant wrapping and ensures consistent
 * FileSystem API usage throughout the codebase.
 * 
 * @param fs - The filesystem client to normalize
 * @returns A FileSystem instance
 */
export function normalizeFs(fs: FsClient): FileSystem {
  // FileSystem constructor already checks for _original_unwrapped_fs
  // and returns the existing instance if already wrapped
  return new FileSystem(fs as any)
}

