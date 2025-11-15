import { makeNodeFixture } from '../../__tests__/__helpers__/FixtureFS/makeNodeFixture.js'
import { checkout } from '../../src/api/checkout.ts'
import { normalizeFs } from '../../src/utils/normalizeFs.ts'
import { join } from '../../src/utils/join.ts'
import { rmRecursive } from '../../src/utils/rmRecursive.ts'
import type { FsClient } from 'isomorphic-git/models'
import type * as fs from 'fs'

export interface TestFixture {
  _fs: typeof fs
  fs: FsClient
  dir: string
  gitdir: string
}

/**
 * Creates a test fixture for Node.js test runner
 * @param fixtureName - Name of the fixture directory
 * @returns Promise resolving to fixture with fs, dir, and gitdir
 */
export async function makeFixture(fixtureName: string): Promise<TestFixture> {
  const fixture = await makeNodeFixture(fixtureName)
  // FileSystem implements FsClient interface, but TypeScript needs explicit cast
  const result = {
    ...fixture,
    fs: fixture.fs as FsClient,
  }
  
  // For test-empty fixture, ensure the index is clean (empty)
  // This matches native git behavior where a fresh repo has an empty index
  // and ensures tests start with a clean state
  if (fixtureName === 'test-empty' && fixture.gitdir) {
    try {
      // Delete the index file directly to ensure clean state
      // This is more reliable than clearing through GitIndexManager since
      // different test instances might use different cache instances
      const indexPath = `${fixture.gitdir}/index`
      try {
        // Check if index file exists before trying to delete it
        const stats = await result.fs.lstat(indexPath)
        if (stats) {
          // File exists, delete it
          await result.fs.rm(indexPath)
        }
      } catch {
        // Index file doesn't exist, which is fine - it will be empty when first accessed
      }
    } catch (error) {
      // If deletion fails, that's okay - the index might not exist yet
      // In that case, the index will be empty when first accessed, which is what we want
    }
  }
  
  return result
}

/**
 * Brutally cleans the working directory by removing all files and directories
 * except for the .git directory. This ensures a pristine state before checkout.
 * 
 * @param fs - File system client
 * @param dir - Working directory path
 */
async function cleanWorkdir(fs: FsClient, dir: string): Promise<void> {
  const normalizedFs = normalizeFs(fs)
  
  try {
    const entries = await normalizedFs.readdir(dir)
    if (!entries) return
    
    for (const entry of entries) {
      // Don't delete the .git directory!
      if (entry === '.git') continue
      
      const fullpath = join(dir, entry)
      
      try {
        const stat = await normalizedFs.lstat(fullpath)
        if (!stat) continue
        
        if ((stat as any).isDirectory()) {
          // Use rmRecursive for directories to handle nested files
          await rmRecursive(normalizedFs, fullpath)
        } else {
          // Remove files directly
          await normalizedFs.rm(fullpath)
        }
      } catch (err) {
        // If we can't stat or remove a file, continue with the next one
        // This handles race conditions and permission issues gracefully
        console.warn(`[cleanWorkdir] Warning: Could not remove ${fullpath}:`, err)
      }
    }
  } catch (err) {
    // If readdir fails, the directory might not exist or be inaccessible
    // This is okay - we'll let checkout handle it
    console.warn(`[cleanWorkdir] Warning: Could not read directory ${dir}:`, err)
  }
}

/**
 * Resets the fixture to a clean state matching a specific commit.
 * This ensures HEAD, the index, and the working directory are all in sync.
 * 
 * This is a true "hard reset" equivalent:
 * 1. Brutally cleans the working directory (removes all untracked files)
 * 2. Checks out the specified commit (restores tracked files and updates index)
 * 
 * @param fs - File system client
 * @param dir - Working directory path
 * @param gitdir - Git directory path (optional, defaults to join(dir, '.git'))
 * @param ref - Reference to reset to (defaults to 'HEAD')
 * @param cache - Cache object to use (optional, defaults to empty object)
 *                IMPORTANT: Pass the same cache used by other git commands in your test
 *                to ensure state consistency across operations
 */
export async function resetToCommit(
  fs: FsClient,
  dir: string,
  gitdir?: string,
  ref: string = 'HEAD',
  cache: Record<string, unknown> = {}
): Promise<void> {
  // Step 1: Brutally clean the working directory
  // This removes all untracked files and directories, ensuring a pristine state
  // This is critical because git checkout does NOT remove untracked files
  await cleanWorkdir(fs, dir)
  
  // Step 2: Checkout the commit to restore tracked files and update the index
  // Use the provided cache to ensure consistency with other git commands
  // This is critical: if checkout uses a different cache than other commands,
  // it will read stale state from disk instead of seeing in-memory updates
  await checkout({
    fs,
    dir,
    gitdir,
    ref,
    force: true, // Force checkout overwrites workdir changes and resets the index.
    cache, // Use the same cache as other commands for state consistency
  })
}

