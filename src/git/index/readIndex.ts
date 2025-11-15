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
    if (!data || data.length === 0) {
      return new GitIndex()
    }
    return await GitIndex.from(data as Buffer | Uint8Array)
  } catch {
    // Index doesn't exist - return empty index
    return new GitIndex()
  }
}

