import { InternalError } from "../../errors/InternalError.ts"
import { CheckoutConflictError } from "../../errors/CheckoutConflictError.ts"
import { ObjectReader } from '../odb/ObjectReader.js'
import { parse as parseTree } from '../parsers/Tree.js'
import { parse as parseCommit } from '../parsers/Commit.js'
import { SparseCheckoutManager } from './SparseCheckoutManager.js'
import { join } from '../GitPath.js'
import { RefManager } from '../refs/RefManager.js'
import { parse as parseIndex, serialize as serializeIndex } from '../index/Index.js'
import { normalizeStats } from "../../utils/normalizeStats.ts"
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

  // Read the index
  let indexBuffer: Buffer
  try {
    const buffer = await fs.read(join(gitdir, 'index'))
    indexBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as string | Uint8Array)
  } catch {
    indexBuffer = Buffer.alloc(0)
  }
  const index = await parseIndex(indexBuffer)

  const operations: CheckoutOperation[] = []

  // Check sparse checkout patterns
  let shouldCheckSparse = false
  let finalSparsePatterns = sparsePatterns
  if (sparsePatterns && sparsePatterns.length > 0) {
    shouldCheckSparse = true
  } else {
    // Check if sparse checkout is enabled
    try {
      const patterns = await SparseCheckoutManager.loadPatterns({ fs, gitdir })
      if (patterns.length > 0) {
        finalSparsePatterns = patterns
        shouldCheckSparse = true
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
        const matches = SparseCheckoutManager.match({ filepath, patterns: finalSparsePatterns })
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
        const workdirPath = join(dir, filepath)
        let workdirExists = false
        try {
          await fs.lstat(workdirPath)
          workdirExists = true
        } catch {
          // File doesn't exist
        }

        // Check if file exists in index
        const indexEntry = index.entries.get(filepath)

        if (!indexEntry && !workdirExists) {
          // New file - create it
          operations.push(['create', filepath, entry.oid, entry.mode])
        } else if (!indexEntry && workdirExists) {
          // File in workdir but not in index - conflict or update
          if (force) {
            operations.push(['update', filepath, entry.oid, entry.mode])
          } else {
            operations.push(['conflict', filepath])
          }
        } else if (indexEntry && !workdirExists) {
          // File in index but not in workdir - restore it
          operations.push(['create', filepath, entry.oid, entry.mode])
        } else if (indexEntry && workdirExists) {
          // File exists in both - check if update needed
          const indexOid =
            indexEntry.oid || (indexEntry.stages && indexEntry.stages[0] ? indexEntry.stages[0].oid : null)
          if (indexOid !== entry.oid) {
            if (force) {
              operations.push(['update', filepath, entry.oid, entry.mode])
            } else {
              // Check if workdir has uncommitted changes
              try {
                const workdirContent = await fs.read(workdirPath)
                const { hashObject } = await import('../ShaHasher.js')
                const workdirOid = await hashObject({
                  type: 'blob',
                  content: workdirContent as Buffer | Uint8Array,
                })
                if (workdirOid !== entry.oid && workdirOid !== indexOid) {
                  operations.push(['conflict', filepath])
                } else {
                  operations.push(['update', filepath, entry.oid, entry.mode])
                }
              } catch {
                operations.push(['conflict', filepath])
              }
            }
          }
        }
      }
    }
  }

  await walkTree(treeOid)

  // Find files in index that should be deleted (simplified - would need full tree walk)
  // This is a simplified version - in a full implementation, we'd need to walk the full tree

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

  // Read index
  let indexBuffer: Buffer
  try {
    const buffer = await fs.read(join(gitdir, 'index'))
    indexBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as string | Uint8Array)
  } catch {
    indexBuffer = Buffer.alloc(0)
  }
  const index = await parseIndex(indexBuffer)

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
      index.entries.delete(op[1] as string)
      if (onProgress) {
        await onProgress({ phase: 'Updating workdir', loaded: ++count, total })
      }
    } else if (op[0] === 'delete-index') {
      index.entries.delete(op[1] as string)
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
        await fs.mkdir(dirPath, { recursive: true })
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

      // Update index - create entry manually
      const stats = await fs.lstat(fullPath)
      const normalizedStats = normalizeStats(stats)
      const entry = {
        path: filepath as string,
        oid: oid as string,
        mode: modeNum,
        ctimeSeconds: normalizedStats.ctimeSeconds,
        ctimeNanoseconds: normalizedStats.ctimeNanoseconds,
        mtimeSeconds: normalizedStats.mtimeSeconds,
        mtimeNanoseconds: normalizedStats.mtimeNanoseconds,
        dev: normalizedStats.dev,
        ino: normalizedStats.ino,
        uid: normalizedStats.uid,
        gid: normalizedStats.gid,
        size: normalizedStats.size,
        flags: {
          assumeValid: false,
          extended: false,
          stage: 0,
          nameLength: Buffer.from(filepath as string).length,
          skipWorktree: false,
          intentToAdd: false,
        },
        stages: [],
      }
      entry.stages = [entry]
      index.entries.set(filepath as string, entry)

      if (onProgress) {
        await onProgress({ phase: 'Updating workdir', loaded: ++count, total })
      }
    } else if (op[0] === 'mkdir') {
      const fullPath = join(dir, op[1] as string)
      await fs.mkdir(fullPath, { recursive: true })
    }
  }

  // Write updated index
  const updatedIndex = await serializeIndex(index)
  await fs.write(join(gitdir, 'index'), updatedIndex)
}

/**
 * Gets the status of a file in the working directory
 */
export const getFileStatus = async ({
  fs,
  dir,
  gitdir,
  filepath,
  cache = {},
}: {
  fs: FsClient
  dir: string
  gitdir: string
  filepath: string
  cache?: Record<string, unknown>
}): Promise<string> => {
  // Get HEAD tree
  let headTreeOid: string | null = null
  try {
    const headOid = await RefManager.resolve({ fs, gitdir, ref: 'HEAD' })
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

  // Get file from index
  let indexBuffer: Buffer
  try {
    const buffer = await fs.read(join(gitdir, 'index'))
    indexBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as string | Uint8Array)
  } catch {
    indexBuffer = Buffer.alloc(0)
  }
  const index = await parseIndex(indexBuffer)
  const indexEntry = index.entries.get(filepath)
  const indexOid = indexEntry ? indexEntry.oid : null

  // Get file from working directory
  const workdirPath = join(dir, filepath)
  let workdirExists = false
  let workdirOid: string | null = null
  try {
    await fs.lstat(workdirPath)
    workdirExists = true
    const content = await fs.read(workdirPath)
    const { hashObject } = await import('../ShaHasher.js')
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
  const operations = await analyzeCheckout({ fs, dir, gitdir, treeOid, filepaths, force, sparsePatterns, cache })
  await executeCheckout({ fs, dir, gitdir, operations, cache, onProgress })
}

