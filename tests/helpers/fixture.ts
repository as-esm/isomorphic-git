import { makeNodeFixture } from './makeNodeFixture.ts'
import { resetToCommit as gitResetToCommit } from '../../src/commands/reset.ts'
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
 * Resets the fixture to a clean state matching a specific commit.
 * This ensures HEAD, the index, and the working directory are all in sync.
 * 
 * This is a wrapper around the git.resetToCommit utility function.
 * It provides a convenient interface for test fixtures.
 * 
 * @param fs - File system client
 * @param dir - Working directory path
 * @param gitdir - Git directory path (optional, defaults to join(dir, '.git'))
 * @param ref - Reference or OID to reset to (defaults to 'HEAD')
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
  // Use the utility function from isomorphic-git
  // This ensures proper branch state (HEAD is not detached)
  await gitResetToCommit({
    fs,
    dir,
    gitdir,
    ref,
    cache,
  })
}

