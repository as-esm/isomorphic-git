/**
 * Reads the Git index directly from .git/index file
 * 
 * This is a stateless helper function that performs only I/O and parsing.
 * Caching is handled by the Repository class, which is the sole authority
 * for in-memory index state.
 * 
 * @param fs - File system client
 * @param gitdir - Path to .git directory
 * @returns The parsed GitIndex object
 */
import { GitIndex } from './GitIndex.ts'
import { normalizeFs } from '../../utils/normalizeFs.ts'
import { join } from '../../core-utils/GitPath.ts'
import type { FsClient } from '../../models/FileSystem.ts'

export async function readIndex({
  fs,
  gitdir,
}: {
  fs: FsClient
  gitdir: string
}): Promise<GitIndex> {
  const normalizedFs = normalizeFs(fs)
  const indexPath = join(gitdir, 'index')
  
  try {
    const data = await normalizedFs.read(indexPath)
    // If data is null/undefined, the file doesn't exist - return empty index
    if (data === null || data === undefined) {
      return new GitIndex()
    }
    // Convert to Buffer if it's not already
    // Handle both Buffer, Uint8Array, and string types
    const buffer = Buffer.isBuffer(data) 
      ? data 
      : typeof data === 'string' 
        ? Buffer.from(data)  // Use default encoding (utf8)
        : Buffer.from(data as Uint8Array)
    
    // If buffer is empty, the file exists but is empty - this is corrupted
    // Let GitIndex.from() throw the appropriate error
    // (File doesn't exist is handled above by returning empty index)
    return await GitIndex.from(buffer)
  } catch (err) {
    // Check if the error is about file not existing (ENOENT)
    // In that case, return empty index (file doesn't exist = no index = empty index)
    if ((err as any).code === 'ENOENT' || (err as any).errno === -2) {
      // Index doesn't exist - return empty index
      return new GitIndex()
    }
    // All other errors (empty file, wrong magic, wrong checksum) should be re-thrown
    // These indicate corrupted index files that should error
    throw err
  }
}

