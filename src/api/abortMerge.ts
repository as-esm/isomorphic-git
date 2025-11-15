import { STAGE } from '../commands/STAGE.ts'
import { TREE } from '../commands/TREE.ts'
import { WORKDIR } from '../commands/WORKDIR.ts'
import { _walk } from '../commands/walk.ts'
import { IndexResetError } from '../errors/IndexResetError.ts'
import { Repository } from "../core-utils/Repository.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { modified } from "../utils/modified.ts"
import { ObjectReader } from "../core-utils/odb/ObjectReader.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Abort a merge in progress.
 *
 * Based on the behavior of git reset --merge, i.e.  "Resets the index and updates the files in the working tree that are different between <commit> and HEAD, but keeps those which are different between the index and working tree (i.e. which have changes which have not been added). If a file that is different between <commit> and the index has unstaged changes, reset is aborted."
 *
 * Essentially, abortMerge will reset any files affected by merge conflicts to their last known good version at HEAD.
 * Any unstaged changes are saved and any staged changes are reset as well.
 *
 * NOTE: The behavior of this command differs slightly from canonical git in that an error will be thrown if a file exists in the index and nowhere else.
 * Canonical git will reset the file and continue aborting the merge in this case.
 *
 * **WARNING:** Running git merge with non-trivial uncommitted changes is discouraged: while possible, it may leave you in a state that is hard to back out of in the case of a conflict.
 * If there were uncommitted changes when the merge started (and especially if those changes were further modified after the merge was started), `git.abortMerge` will in some cases be unable to reconstruct the original (pre-merge) changes.
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.commit='HEAD'] - commit to reset the index and worktree to, defaults to HEAD
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<void>} Resolves successfully once the git index has been updated
 *
 */
export async function abortMerge({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  commit = 'HEAD',
  cache = {},
}: {
  fs: FsClient
  dir: string
  gitdir?: string
  commit?: string
  cache?: Record<string, unknown>
}): Promise<void> {
  try {
    assertParameter('fs', _fs)
    assertParameter('dir', dir)
    assertParameter('gitdir', gitdir)

    // Use Repository to ensure consistent context and error handling
    let repo: Repository | undefined
    try {
      repo = await Repository.open({ fs: _fs, dir, cache, autoDetectConfig: true })
      gitdir = await repo.getGitdir()
      cache = repo.cache
    } catch {
      // If Repository.open fails, continue with provided gitdir
    }

    // If Repository is available, use its abortMerge method
    if (repo) {
      return await repo.abortMerge({ commit })
    }

    const fs = normalizeFs(_fs) as any
    const trees = [TREE({ ref: commit }), WORKDIR(), STAGE()]

    // CRITICAL: Get the Repository instance and pass it to _walk
    // This ensures all walkers use the same Repository instance
    if (!repo) {
      repo = await Repository.open({ fs: _fs, dir, cache, autoDetectConfig: true })
    }
    
    // Read index to get unmerged paths
    const index = await repo.readIndexDirect()
    const unmergedPaths = Array.from(index.unmergedPaths)

    // Track filepaths that should be deleted (when map returns undefined)
    const filesToDelete = new Set<string>()
    
    const results = await _walk({
      repo,
      trees,
      map: async function (path: string, [head, workdir, index]: any[]) {
        const staged = !(await modified(workdir, index))
        const unmerged = unmergedPaths.includes(path)
        const unmodified = !(await modified(index, head))
        const workdirModified = await modified(workdir, head)

        // If unmerged, always reset to HEAD
        if (unmerged) {
          if (head) {
            return {
              path,
              mode: await head.mode(),
              oid: await head.oid(),
              type: await head.type(),
            }
          } else {
            // No HEAD entry for unmerged file - mark for deletion
            filesToDelete.add(path)
            return undefined
          }
        }

        // If staged (workdir == index), reset to HEAD
        if (staged) {
          if (head) {
            return {
              path,
              mode: await head.mode(),
              oid: await head.oid(),
              type: await head.type(),
            }
          } else {
            // No HEAD entry - mark for deletion
            filesToDelete.add(path)
            return undefined
          }
        }

        // If index == head, keep workdir changes (return false to skip)
        if (unmodified) {
          return false
        }

        // If index != head but workdir has unstaged changes, keep workdir changes
        // This means index was modified but workdir has additional changes
        if (workdirModified) {
          return false
        }

        // Otherwise, index != head and workdir == index, reset to HEAD
        if (head) {
          return {
            path,
            mode: await head.mode(),
            oid: await head.oid(),
            type: await head.type(),
          }
        }

        // No HEAD entry, remove from index
        filesToDelete.add(path)
        return undefined
      },
    })

    // Get the latest index instance and modify it
    const finalIndex = await repo.readIndexDirect()
    const gitdir = await repo.getGitdir()
    // Reset paths in index and worktree, this can't be done in _walk because the
    // STAGE walker uses its own index instance.

    for (const entry of results) {
      if (entry === false) continue

      // Handle file deletion: entry is undefined/null means file should be removed
      if (!entry) {
        // Find all files in index that need to be deleted
        // These are files that exist in index but not in HEAD (commit)
        // We need to track which files were processed in the walk
        // For now, we'll handle deletions separately by checking index entries
        continue
      }

      if (entry.type === 'blob') {
        const filepath = entry.path
        const fullPath = join(dir, filepath)
        
        // Read blob content using ObjectReader (handles binary files correctly)
        const { object: blobObject } = await ObjectReader.read({ 
          fs, 
          cache, 
          gitdir, 
          oid: entry.oid 
        })

        // Ensure directory exists
        const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'))
        if (dirPath) {
          await fs.mkdir(dirPath)
        }

        // Write the file with proper binary handling
        const modeNum = typeof entry.mode === 'string' ? parseInt(entry.mode, 8) : entry.mode
        const blobBuffer = Buffer.isBuffer(blobObject) ? blobObject : Buffer.from(blobObject as Uint8Array)
        
        if (modeNum === 0o100644) {
          // Regular file
          await fs.write(fullPath, blobBuffer)
        } else if (modeNum === 0o100755) {
          // Executable file
          await fs.write(fullPath, blobBuffer, { mode: 0o777 })
        } else if (modeNum === 0o120000) {
          // Symlink
          await (fs as { writelink?: (path: string, target: Buffer) => Promise<void> }).writelink?.(
            fullPath,
            blobBuffer
          )
        } else {
          // Default: regular file
          await fs.write(fullPath, blobBuffer)
        }

        // Update index - inserting with stage 0 automatically clears unmerged status
        const stats = await fs.lstat(fullPath)
        finalIndex.insert({
          filepath,
          oid: entry.oid,
          stats,
          stage: 0,
        })
      }
    }

    // Handle file deletions: remove files that were marked for deletion
    for (const filepath of filesToDelete) {
      const fullPath = join(dir, filepath)
      try {
        await fs.rm(fullPath)
      } catch {
        // File might not exist in workdir, that's okay
      }
      finalIndex.delete({ filepath })
    }

    // Also remove files from index that exist in index but not in HEAD (commit)
    // These are files that weren't processed in the walk (don't exist in any of the trees)
    const processedFilepaths = new Set<string>()
    for (const entry of results) {
      if (entry && entry !== false && entry.path) {
        processedFilepaths.add(entry.path)
      }
    }
    // Add files marked for deletion to processed set so we don't double-delete
    for (const filepath of filesToDelete) {
      processedFilepaths.add(filepath)
    }

    // Check for files in index that don't exist in HEAD (commit)
    const indexFilepaths = Array.from(finalIndex.entriesMap.keys())
    const { resolveFilepath } = await import('../utils/resolveFilepath.ts')
    // Use direct resolveRef() for consistency
    const { resolveRef } = await import('../git/refs/readRef.ts')
    const commitOid = await resolveRef({ 
      fs, 
      gitdir, 
      ref: commit 
    })

    for (const filepath of indexFilepaths) {
      if (!processedFilepaths.has(filepath)) {
        // File was not processed - check if it exists in commit tree
        try {
          await resolveFilepath({ fs, cache, gitdir, oid: commitOid, filepath })
          // File exists in commit, it was skipped (keep workdir changes), so don't delete
        } catch {
          // File doesn't exist in commit - remove it from index and workdir
          const fullPath = join(dir, filepath)
          try {
            await fs.rm(fullPath)
          } catch {
            // File might not exist in workdir
          }
          finalIndex.delete({ filepath })
        }
      }
    }
    
    // Write the modified index back
    await repo.writeIndexDirect(finalIndex)
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.abortMerge'
    throw err
  }
}

