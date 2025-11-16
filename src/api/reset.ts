import { checkout } from './checkout.ts'
import { writeRef } from './writeRef.ts'
import { resolveRef } from './resolveRef.ts'
import { currentBranch } from './currentBranch.ts'
import { normalizeFs } from '../utils/normalizeFs.ts'
import { assertParameter } from '../utils/assertParameter.ts'
import { join } from '../utils/join.ts'
import { rmRecursive } from '../utils/rmRecursive.ts'
import type { FsClient } from '../models/FileSystem.ts'

/**
 * Reset the repository to a specific commit (equivalent to `git reset --hard <commit>`).
 * 
 * This function performs a "hard reset" which:
 * 1. Updates the branch ref to point to the specified commit
 * 2. Updates HEAD to point to that branch (ensures HEAD is not detached)
 * 3. Cleans the working directory (removes all untracked files)
 * 4. Checks out the commit (restores tracked files and updates the index)
 * 
 * This ensures HEAD, the index, and the working directory are all in sync with the target commit.
 * 
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - Reference or OID to reset to (e.g., 'HEAD', 'HEAD~1', 'abc123...', 'refs/heads/main')
 * @param {string} [args.branch] - Branch name to reset (defaults to current branch or 'main')
 * @param {object} [args.cache={}] - Cache object to use for consistency across operations
 * 
 * @returns {Promise<void>} Resolves successfully when reset is complete
 * 
 * @example
 * // Reset to a specific commit
 * await git.resetToCommit({
 *   fs,
 *   dir: '/tutorial',
 *   ref: 'abc123...'
 * })
 * 
 * // Reset to HEAD~1 (previous commit)
 * await git.resetToCommit({
 *   fs,
 *   dir: '/tutorial',
 *   ref: 'HEAD~1'
 * })
 * 
 * // Reset a specific branch
 * await git.resetToCommit({
 *   fs,
 *   dir: '/tutorial',
 *   ref: 'abc123...',
 *   branch: 'feature-branch'
 * })
 */
export async function resetToCommit({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  ref,
  branch,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  ref: string
  branch?: string
  cache?: Record<string, unknown>
}): Promise<void> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('ref', ref)

    const fs = normalizeFs(_fs)

    // Step 1: Resolve the commit OID from the ref
    const commitOid = await resolveRef({ fs, gitdir, ref })

    // Step 2: Determine the branch name
    let branchName = branch
    if (!branchName) {
      // Try to get the current branch
      try {
        const currentBranchName = await currentBranch({ fs, gitdir, fullname: true })
        if (currentBranchName && currentBranchName.startsWith('refs/heads/')) {
          branchName = currentBranchName.replace('refs/heads/', '')
        }
      } catch {
        // Current branch doesn't exist or HEAD is detached
      }
      
      // If still no branch, use default
      if (!branchName) {
        // Try to get default branch from config
        let defaultBranch = 'main'
        try {
          const { ConfigAccess } = await import('../utils/configAccess.ts')
          const configAccess = new ConfigAccess(fs, gitdir)
          const initDefaultBranch = await configAccess.getConfigValue('init.defaultBranch')
          if (initDefaultBranch && typeof initDefaultBranch === 'string') {
            defaultBranch = initDefaultBranch
          }
        } catch {
          // Config doesn't exist or can't be read, use 'main'
        }
        branchName = defaultBranch
      }
    }

    // Step 3: Update the branch ref to point to the commit
    // This is the "reset --hard" part for the ref
    await writeRef({
      fs,
      gitdir,
      ref: `refs/heads/${branchName}`,
      value: commitOid,
      force: true,
    })

    // Step 4: Update HEAD to point to that branch (ensures HEAD is not detached)
    await writeRef({
      fs,
      gitdir,
      ref: 'HEAD',
      value: `refs/heads/${branchName}`,
      symbolic: true,
      force: true,
    })

    // Step 5: Clean the working directory (removes all untracked files)
    // This is critical because git checkout does NOT remove untracked files
    if (dir) {
      await cleanWorkdir(fs, dir)
    }

    // Step 6: Checkout HEAD to restore the workdir and index to the correct state
    // This now checks out the branch, not a detached commit
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'HEAD',
      force: true,
      cache,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.resetToCommit'
    throw err
  }
}

/**
 * Clean the working directory by removing all files and directories except .git
 */
async function cleanWorkdir(fs: FsClient, dir: string): Promise<void> {
  try {
    const entries = await fs.readdir(dir)
    if (!entries) return
    
    for (const entry of entries) {
      // Don't delete the .git directory!
      if (entry === '.git') continue
      
      const fullpath = join(dir, entry)
      
      try {
        const stat = await fs.lstat(fullpath)
        if (!stat) continue
        
        if ((stat as any).isDirectory()) {
          // Use rmRecursive for directories to handle nested files
          await rmRecursive(fs, fullpath)
        } else {
          // Remove files directly
          await fs.rm(fullpath)
        }
      } catch (err) {
        // If we can't stat or remove a file, continue with the next one
        // This handles race conditions and permission issues gracefully
        console.warn(`[resetToCommit] Warning: Could not remove ${fullpath}:`, err)
      }
    }
  } catch (err) {
    // If readdir fails, the directory might not exist or be inaccessible
    // This is okay - we'll let checkout handle it
    console.warn(`[resetToCommit] Warning: Could not read directory ${dir}:`, err)
  }
}

