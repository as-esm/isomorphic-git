/**
 * Writes the Git index directly to .git/index file
 * 
 * This is a stateless helper function that performs only I/O and serialization.
 * Caching is handled by the Repository class, which is the sole authority
 * for in-memory index state.
 * 
 * @param fs - File system client
 * @param gitdir - Path to .git directory
 * @param index - The GitIndex object to write
 */
import { GitIndex } from './GitIndex.ts'
import { normalizeFs } from '../../utils/normalizeFs.ts'
import { join } from '../../core-utils/GitPath.ts'
import type { FsClient } from '../../models/FileSystem.ts'

export async function writeIndex({
  fs,
  gitdir,
  index,
}: {
  fs: FsClient
  gitdir: string
  index: GitIndex
}): Promise<void> {
  const normalizedFs = normalizeFs(fs)
  const indexPath = join(gitdir, 'index')
  
  const buffer = await index.toObject()
  await normalizedFs.write(indexPath, buffer)
  
  // Ensure write is flushed to disk
  if (normalizedFs.sync) {
    await normalizedFs.sync(indexPath)
  }
}

