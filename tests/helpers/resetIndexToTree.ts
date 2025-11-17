import type { FsClient } from '../../src/models/FileSystem.ts'
import { listFiles } from 'isomorphic-git'
import { GitIndex } from '../../src/git/index/GitIndex.ts'
import { resolveFilepath } from '../../src/utils/resolveFilepath.ts'
import { normalizeFs } from '../../src/utils/normalizeFs.ts'
import { join } from '../../src/utils/join.ts'
import { normalize as normalizePath } from '../../src/core-utils/GitPath.ts'

/**
 * Reset the entire index to match a specific tree (e.g., HEAD)
 * This is useful for tests that need a clean index state
 * Uses Repository.writeIndexDirect() to ensure cache consistency
 */
export async function resetIndexToTree({
  fs,
  dir,
  gitdir,
  ref = 'HEAD',
  cache = {},
}: {
  fs: FsClient
  dir: string
  gitdir: string
  ref?: string
  cache?: Record<string, unknown>
}): Promise<void> {
  const normalizedFs = normalizeFs(fs)
  
  // Use Repository to ensure cache consistency
  const { Repository } = await import('../../src/core-utils/Repository.ts')
  const repo = await Repository.open({ fs, dir, cache, autoDetectConfig: true })
  const effectiveGitdir = await repo.getGitdir()
  
  // Get all file paths from the tree using listFiles (handles nested trees)
  const filePaths = await listFiles({ fs, dir, gitdir: effectiveGitdir, ref, cache })
  
  // Resolve the commit/tree OID
  const { resolveRef } = await import('../../src/git/refs/readRef.ts')
  let treeOid: string
  try {
    const commitOid = await resolveRef({ fs, gitdir: effectiveGitdir, ref })
    const { readObject } = await import('../../src/git/objects/readObject.ts')
    const { parseCommit } = await import('../../src/core-utils/parsers/Commit.ts')
    const commitResult = await readObject({ fs, cache, gitdir: effectiveGitdir, oid: commitOid, format: 'content' })
    if (commitResult.type === 'commit') {
      const commit = parseCommit(commitResult.object)
      treeOid = commit.tree
    } else {
      // If ref points directly to a tree
      treeOid = commitOid
    }
  } catch {
    // If ref doesn't exist or can't be resolved, return early
    // This allows tests to work even if HEAD doesn't exist yet
    return
  }
  
  // CRITICAL: First, read the current index and clear ALL entries
  // This ensures we start with a completely clean index
  const currentIndex = await repo.readIndexDirect(false) // Force fresh read
  const allCurrentPaths = Array.from(currentIndex.entriesMap.keys())
  
  // Create a new empty index (this ensures we start fresh)
  const index = new GitIndex()
  
  // Add all entries from the tree
  for (const filepath of filePaths) {
    try {
      // Resolve the OID for this filepath in the tree
      const blobOid = await resolveFilepath({
        fs,
        cache,
        gitdir: effectiveGitdir,
        oid: treeOid,
        filepath,
      })
      
      // Get stats from working directory if file exists
      let stats
      try {
        stats = await normalizedFs.lstat(join(dir, filepath))
      } catch {
        // File doesn't exist in workdir, use default stats
        stats = {
          ctime: new Date(0),
          mtime: new Date(0),
          dev: 0,
          ino: 0,
          mode: 0o100644,
          uid: 0,
          gid: 0,
          size: 0,
        }
      }
      
      // Insert into index
      index.insert({
        filepath,
        stats,
        oid: blobOid,
      })
    } catch (error) {
      // If we can't resolve the filepath, skip it
      // This can happen if the file was deleted or doesn't exist in the tree
      console.warn(`Could not resolve filepath ${filepath} in tree ${treeOid}:`, error)
    }
  }
  
  // Write the index using Repository.writeIndexDirect() to ensure cache consistency
  await repo.writeIndexDirect(index)
  
  // CRITICAL: Invalidate the cache to force fresh reads
  // This ensures that subsequent reads will get the new index state
  const normalizedGitdir = normalizePath(effectiveGitdir)
  const cacheKey = `index:${normalizedGitdir}`
  if (cache) {
    // Delete the cache entry to force fresh read on next access
    delete cache[cacheKey]
    
    // Cache is now managed by Repository instance, no need to manually invalidate
  }
}

