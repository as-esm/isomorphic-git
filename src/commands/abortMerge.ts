import { readTree } from './readTree.ts'
import { Repository } from "../core-utils/Repository.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { readObject } from "../git/objects/readObject.ts"
import { hashObject } from '../core-utils/ShaHasher.ts'
import { StateManager } from '../core-utils/StateManager.ts'
import type { FsClient } from "../models/FileSystem.ts"
import type { TreeEntry } from '../models/GitTree.ts'

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
  gitdir: _gitdir,
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
    // CRITICAL: Initialize gitdir BEFORE using it to avoid temporal dead zone issues
    const gitdir = _gitdir || join(dir, '.git')
    assertParameter('gitdir', gitdir)

    const fs = normalizeFs(_fs)

    // 1. Open the repository to get a consistent context
    const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
    const effectiveGitdir = await repo.getGitdir()
    cache = repo.cache

    // 2. Load all necessary state into memory ONCE
    const { resolveRef } = await import('../git/refs/readRef.ts')
    const HEAD_oid = await resolveRef({ fs, gitdir: effectiveGitdir, ref: commit })
    const { tree: headTree } = await readTree({ fs, cache, gitdir: effectiveGitdir, oid: HEAD_oid })
    const headTreeEntries = new Map<string, TreeEntry>()
    for (const entry of headTree) {
      if (entry.type === 'blob') {
        headTreeEntries.set(entry.path, entry)
      }
    }

    const index = await repo.readIndexDirect()
    const unmergedPaths = new Set(index.unmergedPaths)
    
    // Build index entries map (only stage 0 entries, or use the first stage for unmerged)
    const indexEntries = new Map<string, { oid: string; mode: number; stats?: any }>()
    for (const entry of index.entries) {
      if (entry.stage === 0 || (entry.stage !== 0 && !indexEntries.has(entry.path))) {
        indexEntries.set(entry.path, {
          oid: entry.oid,
          mode: entry.mode,
          stats: entry.stat,
        })
      }
    }

    // 3. Compute workdir OIDs ONLY for files that are in index or HEAD
    // This avoids expensive SHA-1 computation for irrelevant files
    const workdirOids = new Map<string, string>()
    const allRelevantPaths = new Set([...headTreeEntries.keys(), ...indexEntries.keys()])
    
    for (const filepath of allRelevantPaths) {
      const fullPath = join(dir, filepath)
      try {
        const stat = await fs.lstat(fullPath)
        if (stat && !stat.isDirectory()) {
          const content = await fs.read(fullPath)
          const oid = await hashObject({ type: 'blob', content: content as Buffer | Uint8Array })
          workdirOids.set(filepath, oid)
        }
      } catch {
        // File doesn't exist in workdir, that's okay
      }
    }

    // 4. Determine which files to reset (the core logic)
    const operations: Array<{ op: 'update' | 'delete', path: string, oid?: string, mode?: string }> = []
    const newIndexEntries = new Map<string, { oid: string; mode: number; stats?: any }>()

    for (const filepath of allRelevantPaths) {
      const headEntry = headTreeEntries.get(filepath)
      const indexEntry = indexEntries.get(filepath)
      const workdirOid = workdirOids.get(filepath)

      const isUnmerged = unmergedPaths.has(filepath)
      const isStaged = indexEntry && (!workdirOid || indexEntry.oid === workdirOid)
      const hasUnstagedChanges = indexEntry && workdirOid && indexEntry.oid !== workdirOid

      if (isUnmerged || (isStaged && !hasUnstagedChanges)) {
        // Case 1: Unmerged file -> Reset to HEAD
        // Case 2: Staged change with no unstaged changes -> Reset to HEAD
        if (headEntry) {
          operations.push({ op: 'update', path: filepath, oid: headEntry.oid, mode: headEntry.mode })
          // Get stats from workdir if it exists, otherwise use index stats
          let stats = indexEntry?.stats
          if (!stats) {
            try {
              const fullPath = join(dir, filepath)
              stats = await fs.lstat(fullPath)
            } catch {
              // File doesn't exist, will be created
            }
          }
          newIndexEntries.set(filepath, {
            oid: headEntry.oid,
            mode: parseInt(headEntry.mode, 8),
            stats,
          })
        } else {
          operations.push({ op: 'delete', path: filepath })
          // Entry is removed from newIndexEntries by not adding it
        }
      } else if (hasUnstagedChanges) {
        // Case 3: Has unstaged changes -> Keep workdir, reset index to HEAD
        if (headEntry) {
          // Get stats from workdir
          let stats = indexEntry?.stats
          if (!stats) {
            try {
              const fullPath = join(dir, filepath)
              stats = await fs.lstat(fullPath)
            } catch {
              // Shouldn't happen if hasUnstagedChanges is true
            }
          }
          newIndexEntries.set(filepath, {
            oid: headEntry.oid,
            mode: parseInt(headEntry.mode, 8),
            stats,
          })
        }
      } else if (indexEntry) {
        // Case 4: Not staged, not unmerged, no unstaged changes -> Keep as is
        newIndexEntries.set(filepath, indexEntry)
      }
    }

    // 5. Also handle files that exist in index but not in HEAD or workdir
    // These need to be removed
    for (const [filepath, indexEntry] of indexEntries.entries()) {
      if (!headTreeEntries.has(filepath) && !workdirOids.has(filepath)) {
        operations.push({ op: 'delete', path: filepath })
        // Don't add to newIndexEntries (removes from index)
      }
    }

    // 6. Execute the plan on the workdir
    for (const op of operations) {
      const fullPath = join(dir, op.path)
      if (op.op === 'update') {
        const { object } = await readObject({ fs, cache, gitdir: effectiveGitdir, oid: op.oid! })
        const modeNum = parseInt(op.mode!, 8)
        
        // Ensure directory exists
        const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'))
        if (dirPath && dirPath !== dir) {
          await fs.mkdir(dirPath)
        }

        const blobBuffer = Buffer.isBuffer(object) ? object : Buffer.from(object as Uint8Array)
        
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
      } else if (op.op === 'delete') {
        try {
          await fs.rm(fullPath)
        } catch {
          // File might not exist in workdir, that's okay
        }
      }
    }

    // 7. Update the index
    // Clear all entries and rebuild from newIndexEntries
    const finalIndex = await repo.readIndexDirect()
    
    // Delete all existing entries (this also clears unmerged paths for deleted entries)
    const allIndexPaths = Array.from(finalIndex.entriesMap.keys())
    for (const filepath of allIndexPaths) {
      finalIndex.delete({ filepath })
    }
    
    // Now insert all the new entries with stage 0 (this automatically clears unmerged status)
    for (const [filepath, entry] of newIndexEntries.entries()) {
      // Get fresh stats if available, otherwise use entry.stats
      let stats = entry.stats
      if (!stats) {
        try {
          const fullPath = join(dir, filepath)
          stats = await fs.lstat(fullPath)
        } catch {
          // File might not exist, skip
          continue
        }
      }
      
      finalIndex.insert({
        filepath,
        oid: entry.oid,
        stats,
        stage: 0,
      })
    }

    await repo.writeIndexDirect(finalIndex)

    // 8. Clean up merge state files
    const stateManager = new StateManager(fs, effectiveGitdir)
    await stateManager.clearMergeHead()

  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.abortMerge'
    throw err
  }
}

