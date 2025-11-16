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
    // Try to read the file - this will throw ENOENT if it doesn't exist
    const data = await normalizedFs.read(indexPath)
    
    // If data is null/undefined, treat as missing file
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
    
    // If file exists but buffer is empty, this is corrupted
    // A valid index file should never be empty - it should either not exist or have content
    // Let GitIndex.from() throw the appropriate error
    if (buffer.length === 0) {
      return await GitIndex.from(buffer) // This will throw "Index file is empty"
    }
    
    // Parse the index file
    return await GitIndex.from(buffer)
  } catch (err) {
    // Check if the error is about file not existing (ENOENT)
    // In that case, return empty index (file doesn't exist = no index = empty index)
    if ((err as any).code === 'ENOENT' || (err as any).errno === -2) {
      // Index doesn't exist - return empty index (valid state)
      return new GitIndex()
    }
    // All other errors (empty file, wrong magic, wrong checksum) should be re-thrown
    // These indicate corrupted index files that should error
    throw err
  }
}

