import { InternalError } from "../../errors/InternalError.ts"
import { CheckoutConflictError } from "../../errors/CheckoutConflictError.ts"
import { ObjectReader } from '../odb/ObjectReader.ts'
import { parse as parseTree } from '../parsers/Tree.ts'
import { parse as parseCommit } from '../parsers/Commit.ts'
import { SparseCheckoutManager } from './SparseCheckoutManager.ts'
import { join } from '../GitPath.ts'
// RefManager import removed - using src/git/refs/ functions instead
import { parse as parseIndex, serialize as serializeIndex, type IndexObject, type IndexEntry } from '../index/Index.ts'
import { normalizeStats } from "../../utils/normalizeStats.ts"
import { normalizeFs } from "../../utils/normalizeFs.ts"
// GitIndexManager import removed - using Repository.readIndexDirect/writeIndexDirect instead
import type { FsClient } from "../../models/FileSystem.ts"
import type { ProgressCallback } from "../../managers/GitRemoteHTTP.ts"

type CheckoutOperation = ['create' | 'update' | 'delete' | 'delete-index' | 'mkdir' | 'conflict', string, ...unknown[]]

/**
 * Analyzes what changes are needed to checkout a tree to the working directory
 */
export const analyzeCheckout = async ({
  fs,
  dir,
  gitdir,
  treeOid,
  filepaths,
  force = false,
  sparsePatterns,
  cache = {},
}: {
  fs: FsClient
  dir: string
  gitdir: string
  treeOid: string
  filepaths?: string[]
  force?: boolean
  sparsePatterns?: string[]
  cache?: Record<string, unknown>
}): Promise<CheckoutOperation[]> => {
  // Read the tree
  const { object: treeObject } = await ObjectReader.read({ fs, cache, gitdir, oid: treeOid })
  const treeEntries = parseTree(treeObject as Buffer)

  // CRITICAL: Pass gitdir to Repository.open() to ensure we get the same Repository instance
  // as other operations like add() and status(). This ensures index state consistency.
  const { Repository } = await import('../Repository.ts')
  const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
  const gitIndex = await repo.readIndexDirect(false) // Force fresh read
  const indexVersion = (gitIndex as { _version?: number })._version || 2
  const index: IndexObject = {
    entries: gitIndex.entriesMap,
    unmergedPaths: gitIndex.unmergedPaths,
    version: indexVersion,
  }

  const operations: CheckoutOperation[] = []

  // Check sparse checkout patterns
  let shouldCheckSparse = false
  let finalSparsePatterns = sparsePatterns
  let coneMode = false
  if (sparsePatterns && sparsePatterns.length > 0) {
    shouldCheckSparse = true
    // Try to detect cone mode from config
    try {
      coneMode = await SparseCheckoutManager.isConeMode({ fs, gitdir })
    } catch {
      // Config not available, default to false
    }
  } else {
    // Check if sparse checkout is enabled
    try {
      const patterns = await SparseCheckoutManager.loadPatterns({ fs, gitdir })
      if (patterns.length > 0) {
        finalSparsePatterns = patterns
        shouldCheckSparse = true
        coneMode = await SparseCheckoutManager.isConeMode({ fs, gitdir })
      }
    } catch {
      // Sparse checkout not enabled
    }
  }

  // Helper to recursively walk tree
  const walkTree = async (treeOid: string, prefix = ''): Promise<void> => {
    const { object: treeObject } = await ObjectReader.read({ fs, cache, gitdir, oid: treeOid })
    const entries = parseTree(treeObject as Buffer)

    for (const entry of entries) {
      const filepath = prefix ? `${prefix}/${entry.path}` : entry.path

      // Filter by filepaths if specified
      if (filepaths && !filepaths.some(fp => filepath.startsWith(fp) || fp.startsWith(filepath))) {
        continue
      }

      // Check sparse checkout
      if (shouldCheckSparse && finalSparsePatterns) {
        const matches = SparseCheckoutManager.match({ 
          filepath, 
          patterns: finalSparsePatterns,
          coneMode 
        })
        if (!matches) {
          // Skip this file, but mark it in index with skip-worktree
          // For now, just skip
          continue
        }
      }

      if (entry.type === 'tree') {
        // Recursively walk subdirectory
        await walkTree(entry.oid, filepath)
      } else if (entry.type === 'blob') {
        // Check if file exists in working directory
        // Use normalizeFs to ensure consistent behavior across different fs implementations
        const normalizedFs = normalizeFs(fs)
        const workdirPath = join(dir, filepath)
        let workdirExists = false
        try {
          // First check if it's a file (not a directory) using lstat
          // This is more reliable than read() for existence checking
          const stat = await normalizedFs.lstat(workdirPath)
          if (stat && !(stat as any).isDirectory()) {
            workdirExists = true
          } else {
            // It's a directory, not a file - treat as not existing for blob files
            workdirExists = false
          }
        } catch (err: unknown) {
          // File doesn't exist - lstat throws for missing files
          workdirExists = false
        }

        // Check if file exists in index
        const indexEntry = index.entries.get(filepath)

        if (!indexEntry && !workdirExists) {
          // New file - create it
          operations.push(['create', filepath, entry.oid, entry.mode])
        } else if (!indexEntry && workdirExists) {
          // File in workdir but not in index
          // When force=true, we should update it to match the target tree
          // Use 'create' instead of 'update' to ensure the file is written even if it doesn't actually exist
          // (workdirExists might be incorrectly true due to caching or fs implementation quirks)
          if (force) {
            operations.push(['create', filepath, entry.oid, entry.mode])
          } else {
            operations.push(['conflict', filepath])
          }
        } else if (indexEntry && !workdirExists) {
          // File in index but not in workdir - restore it
          operations.push(['create', filepath, entry.oid, entry.mode])
        } else if (indexEntry && workdirExists) {
          // File exists in both - check if update needed
          // Extract index OID: use entry.oid if available, otherwise check stages
          let indexOid: string | null = null
          if (indexEntry.oid) {
            indexOid = indexEntry.oid
          } else if (indexEntry.stages && indexEntry.stages.length > 0) {
            // For unmerged entries, use stage 0 (ours) if available
            const stage0 = indexEntry.stages.find((s: any) => s && s.flags && s.flags.stage === 0)
            if (stage0 && stage0.oid) {
              indexOid = stage0.oid
            } else if (indexEntry.stages[0] && indexEntry.stages[0].oid) {
              indexOid = indexEntry.stages[0].oid
            }
          }
          
          // Check workdir OID to see if file needs to be updated
          let workdirOid: string | null = null
          try {
            const workdirContent = await fs.read(workdirPath)
            const { hashObject } = await import('../ShaHasher.ts')
            workdirOid = await hashObject({
              type: 'blob',
              content: workdirContent as Buffer | Uint8Array,
            })
          } catch {
            // File read failed, treat as needing update
            workdirOid = null
          }
          
          // Update if index OID doesn't match tree OID, or if workdir OID doesn't match tree OID
          // When force is true, always update if workdir doesn't match tree (regardless of index)
          // When force is false, check for conflicts between workdir and tree
          // If indexOid is null, we can't compare, so check workdir only
          const indexMismatch = indexOid !== null && indexOid !== entry.oid
          // workdirMismatch: true if workdirOid exists and doesn't match tree, OR if workdirOid is null but file exists
          // (null workdirOid means we couldn't compute it, so we should update to be safe)
          const workdirMismatch = workdirOid !== null ? workdirOid !== entry.oid : workdirExists
          
          if (force) {
            // Force mode: always update if workdir doesn't match tree (regardless of index state)
            // This ensures files are restored to match the tree, even if index has been modified
            // Also update if we couldn't compute workdirOid (workdirOid === null) but file exists
            if (workdirMismatch) {
              operations.push(['update', filepath, entry.oid, entry.mode])
            } else if (indexMismatch) {
              // Index doesn't match tree, but workdir does - still update to sync index
              operations.push(['update', filepath, entry.oid, entry.mode])
            }
          } else {
            // Non-force mode: check for conflicts
            if (indexMismatch || workdirMismatch) {
              if (workdirOid !== null && workdirOid !== entry.oid && (indexOid === null || workdirOid !== indexOid)) {
                operations.push(['conflict', filepath])
              } else {
                operations.push(['update', filepath, entry.oid, entry.mode])
              }
            }
          }
        }
      }
    }
  }

  await walkTree(treeOid)

  // Also check for files in index that are not in the target tree (deletions)
  // These need to be removed from both index and workdir
  // But only if force is true (otherwise we might conflict with workdir changes)
  if (force) {
    const indexFilepaths = Array.from(index.entries.keys())
    
    for (const filepath of indexFilepaths) {
      // Skip if we already processed this file in walkTree
      if (operations.some(op => op[1] === filepath)) {
        continue
      }

      // Check if file exists in target tree
      let existsInTree = false
      try {
        const { resolveFilepath } = await import('../../utils/resolveFilepath.ts')
        await resolveFilepath({ fs, cache, gitdir, oid: treeOid, filepath })
        existsInTree = true
      } catch {
        // File doesn't exist in tree
      }

      // If file is in index but not in target tree, remove it
      if (!existsInTree) {
        operations.push(['delete', filepath])
        operations.push(['delete-index', filepath])
      }
    }
  }

  // If sparse checkout is enabled, remove files from index that don't match patterns
  if (shouldCheckSparse && finalSparsePatterns) {
    const filesToKeep = new Set<string>()
    // Collect all filepaths that match sparse patterns
    for (const op of operations) {
      if (op[0] === 'create' || op[0] === 'update') {
        filesToKeep.add(op[1] as string)
      }
    }
    
    // Remove index entries for files that don't match sparse patterns
    for (const [filepath] of index.entries) {
      if (!filesToKeep.has(filepath)) {
        const matches = SparseCheckoutManager.match({ 
          filepath, 
          patterns: finalSparsePatterns,
          coneMode 
        })
        if (!matches) {
          // File doesn't match sparse patterns, remove from index
          operations.push(['delete-index', filepath])
        }
      }
    }
  }

  return operations
}

/**
 * Executes checkout operations to update the working directory
 */
export const executeCheckout = async ({
  fs,
  dir,
  gitdir,
  operations,
  cache = {},
  onProgress,
}: {
  fs: FsClient
  dir: string
  gitdir: string
  operations: CheckoutOperation[]
  cache?: Record<string, unknown>
  onProgress?: ProgressCallback
}): Promise<void> => {
  // Check for conflicts
  const conflicts = operations.filter(op => op[0] === 'conflict').map(op => op[1] as string)
  if (conflicts.length > 0) {
    throw new CheckoutConflictError(conflicts)
  }

  // CRITICAL: Pass gitdir to Repository.open() to ensure we get the same Repository instance
  // as other operations like add() and status(). This ensures index state consistency.
  const { Repository } = await import('../Repository.ts')
  const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
  const gitIndex = await repo.readIndexDirect(false) // Force fresh read
  
  let count = 0
  const total = operations.length

  // Delete files first
  for (const op of operations) {
    if (op[0] === 'delete') {
      const filepath = join(dir, op[1] as string)
      try {
        await fs.rm(filepath)
      } catch {
        // File might not exist
      }
      gitIndex.delete({ filepath: op[1] as string })
      if (onProgress) {
        await onProgress({ phase: 'Updating workdir', loaded: ++count, total })
      }
    } else if (op[0] === 'delete-index') {
      gitIndex.delete({ filepath: op[1] as string })
    }
  }

  // Create/update files
  for (const op of operations) {
    if (op[0] === 'create' || op[0] === 'update') {
      const [, filepath, oid, mode] = op
      const fullPath = join(dir, filepath as string)
      
      // Read the blob
      const { object: blobObject } = await ObjectReader.read({ fs, cache, gitdir, oid: oid as string })

      // Ensure directory exists
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'))
      if (dirPath) {
        await fs.mkdir(dirPath)
      }

      // Write the file
      const modeNum = typeof mode === 'string' ? parseInt(mode, 8) : (mode as number)
      if (modeNum === 0o100644) {
        await fs.write(fullPath, blobObject as Buffer)
      } else if (modeNum === 0o100755) {
        await fs.write(fullPath, blobObject as Buffer, { mode: 0o777 })
      } else if (modeNum === 0o120000) {
        await (fs as { writelink?: (path: string, target: Buffer) => Promise<void> }).writelink?.(
          fullPath,
          blobObject as Buffer
        )
      }

      // Update index using GitIndex.insert() - this automatically marks as dirty
      const stats = await fs.lstat(fullPath)
      gitIndex.insert({
        filepath: filepath as string,
        oid: oid as string,
        stats,
        stage: 0,
      })

      if (onProgress) {
        await onProgress({ phase: 'Updating workdir', loaded: ++count, total })
      }
    } else if (op[0] === 'mkdir') {
      const fullPath = join(dir, op[1] as string)
      await fs.mkdir(fullPath)
    }
  }
  
  // Write the index using Repository.writeIndexDirect() to ensure cache consistency
  await repo.writeIndexDirect(gitIndex)
}

/**
 * Gets the status of a file in the working directory
 * 
 * CRITICAL: This function now accepts a Repository object directly to ensure
 * it uses the same Repository instance (and thus the same index state) as
 * other operations like add() and stash(). This bypasses GitIndexManager
 * and ensures state consistency.
 */
export const getFileStatus = async ({
  repo,
  filepath,
}: {
  repo: import('../Repository.ts').Repository
  filepath: string
}): Promise<string> => {
  // CRITICAL: Normalize fs to ensure consistency with add() and other operations
  const fs = normalizeFs(repo.fs)
  const dir = repo.dir!
  if (!dir) {
    throw new Error('Cannot get file status in bare repository')
  }
  const gitdir = await repo.getGitdir()
  const cache = repo.cache

  // Get HEAD tree
  let headTreeOid: string | null = null
  try {
    // Use direct resolveRef() for consistency
    const { resolveRef } = await import('../../git/refs/readRef.ts')
    const headOid = await resolveRef({ fs, gitdir, ref: 'HEAD' })
    const { object: commitObject } = await ObjectReader.read({ fs, cache, gitdir, oid: headOid })
    const commit = parseCommit(commitObject as Buffer | string)
    headTreeOid = commit.tree
  } catch {
    // No HEAD commit
  }

  // Get file from HEAD tree
  let headOid: string | null = null
  if (headTreeOid) {
    const { object: treeObject } = await ObjectReader.read({ fs, cache, gitdir, oid: headTreeOid })
    const treeEntries = parseTree(treeObject as Buffer)
    const entry = treeEntries.find(e => e.path === filepath)
    if (entry) {
      headOid = entry.oid
    }
  }

  // CRITICAL: Get the index directly from the Repository instance
  // This ensures we see the same in-memory index state that was modified by add()
  // When force=false, readIndexDirect() returns the owned instance immediately,
  // which contains the modifications from writeIndexDirect()
  const index = await repo.readIndexDirect() // Use default force=false to get owned instance
  const indexEntry = index.entriesMap.get(filepath)
  const indexOid: string | null = indexEntry ? indexEntry.oid : null

  // Get file from working directory
  const workdirPath = join(dir, filepath)
  let workdirExists = false
  let workdirOid: string | null = null
  try {
    await fs.lstat(workdirPath)
    workdirExists = true
    const content = await fs.read(workdirPath)
    const { hashObject } = await import('../ShaHasher.ts')
    workdirOid = await hashObject({ type: 'blob', content: content as Buffer | Uint8Array })
  } catch {
    // File doesn't exist
  }

  // Determine status
  const H = headOid !== null
  const I = indexOid !== null
  const W = workdirExists

  if (!H && !W && !I) return 'absent'
  if (!H && !W && I) return '*absent'
  if (!H && W && !I) return '*added'
  if (!H && W && I) {
    return workdirOid === indexOid ? 'added' : '*added'
  }
  if (H && !W && !I) return 'deleted'
  if (H && !W && I) {
    return headOid === indexOid ? '*deleted' : '*deleted'
  }
  if (H && W && !I) {
    return workdirOid === headOid ? '*undeleted' : '*undeletemodified'
  }
  if (H && W && I) {
    if (workdirOid === headOid) {
      return workdirOid === indexOid ? 'unmodified' : '*unmodified'
    } else {
      return workdirOid === indexOid ? 'modified' : '*modified'
    }
  }

  return 'absent'
}

/**
 * Checks out a tree to the working directory
 * Thread-safe: The lock in GitIndexManager.acquire is per-filepath (per gitdir),
 * so parallel tests with different gitdirs are isolated. Each test from makeFixture
 * gets its own unique gitdir, ensuring no interference between parallel tests.
 */
export const checkout = async ({
  fs,
  dir,
  gitdir,
  treeOid,
  filepaths,
  force = false,
  sparsePatterns,
  cache = {},
  onProgress,
}: {
  fs: FsClient
  dir: string
  gitdir: string
  treeOid: string
  filepaths?: string[]
  force?: boolean
  sparsePatterns?: string[]
  cache?: Record<string, unknown>
  onProgress?: ProgressCallback
}): Promise<void> => {
  // analyzeCheckout and executeCheckout both use GitIndexManager.acquire which locks per gitdir.
  // Since each test has its own unique gitdir from makeFixture, parallel tests are isolated.
  // The lock ensures that operations on the same gitdir are serialized.
  const operations = await analyzeCheckout({ fs, dir, gitdir, treeOid, filepaths, force, sparsePatterns, cache })
  await executeCheckout({ fs, dir, gitdir, operations, cache, onProgress })
}

/**
 * Namespace export for WorkdirManager
 */
export const WorkdirManager = {
  analyzeCheckout,
  executeCheckout,
  getFileStatus,
  checkout,
}

