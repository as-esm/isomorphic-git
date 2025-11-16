import AsyncLock from 'async-lock'

import { STAGE } from '../commands/STAGE.ts'
import { TREE } from '../commands/TREE.ts'
import { WORKDIR } from '../commands/WORKDIR.ts'
import { _walk } from '../commands/walk.ts'
import { writeTree } from '../commands/writeTree.ts'
import { InternalError } from '../errors/InternalError.ts'
import { NotFoundError } from '../errors/NotFoundError.ts'
import { isIgnored as isIgnoredInternal } from "../git/info/isIgnored.ts"
// GitIndexManager import removed - using Repository.readIndexDirect/writeIndexDirect instead
import { readObject } from "../git/objects/readObject.ts"
import { read as readLoose } from "../git/objects/loose.ts"
import { writeObject } from "../git/objects/writeObject.ts"
import { join } from './join.ts'
import { posixifyPathBuffer } from './posixifyPathBuffer.ts'
import { normalizeFs } from './normalizeFs.ts'
import { detectChange } from './changeDetection.ts'
import type { FsClient } from "../models/FileSystem.ts"
import type { ObjectType } from "../models/GitObject.ts"
import type { TreeEntry } from "../models/GitTree.ts"
import type { Walker, WalkerEntry } from "../models/Walker.ts"
import type { GitIndex } from "../git/index/GitIndex.ts"

const _TreeMap: Record<string, () => Walker> = {
  stage: STAGE,
  workdir: WORKDIR,
}

let lock: AsyncLock | undefined
export async function acquireLock<T>(ref: string | { filepath: string }, callback: () => Promise<T>): Promise<T> {
  if (lock === undefined) lock = new AsyncLock()
  const lockKey = typeof ref === 'string' ? ref : ref.filepath
  return lock.acquire(lockKey, callback)
}

// make sure filepath, blob type and blob object (from loose objects) plus oid are in sync and valid
async function checkAndWriteBlob(
  fs: FsClient,
  gitdir: string,
  dir: string,
  filepath: string,
  oid: string | null = null,
  cache: Record<string, unknown> = {}
): Promise<string | undefined> {
  const normalizedFs = normalizeFs(fs)
  const currentFilepath = join(dir, filepath)
  
  // If OID is provided, first check if the object exists in the object store (loose or packed)
  if (oid) {
    try {
      const objResult = await readObject({ fs, cache, gitdir, oid, format: 'content' })
      if (objResult) {
        // Object exists in the store, return the OID
        return oid
      }
    } catch (error) {
      // Object doesn't exist in store - this can happen if the blob wasn't written yet
      // or if there's a cache issue. For staged files, the OID should exist.
      // Continue to try reading from working directory as fallback
    }
  }
  
  // Object doesn't exist in store (or OID not provided), try reading from working directory
  let stats
  try {
    stats = await normalizedFs.lstat(currentFilepath)
  } catch {
    // File doesn't exist in working directory
    if (oid) {
      // If OID was provided but object doesn't exist in store and file doesn't exist in workdir,
      // For staged files, the OID should exist in the object store (written by add())
      // If it doesn't exist, it might be a timing issue or the blob wasn't written yet
      // In this case, we should still return the OID and let the tree be written with it
      // The tree will be valid even if the blob doesn't exist yet (it will be written later)
      // Return the OID anyway - the tree structure is what matters
      return oid
    }
    // If no OID provided and file doesn't exist, return undefined
    return undefined
  }
  
  if (!stats) {
    if (oid) {
      throw new NotFoundError(currentFilepath)
    }
    return undefined
  }
  
  if ((stats as any).isDirectory())
    throw new InternalError(
      `${currentFilepath}: file expected, but found directory`
    )

  // Read from working directory and write to object store
  let retOid: string | undefined = undefined
  await acquireLock({ filepath: currentFilepath }, async () => {
    const object = (stats as any).isSymbolicLink()
      ? await normalizedFs.readlink(currentFilepath).then((link: Buffer | string | null) => {
          if (link === null) throw new NotFoundError(currentFilepath)
          return posixifyPathBuffer(Buffer.isBuffer(link) ? link : Buffer.from(link))
        })
      : await normalizedFs.read(currentFilepath)

    if (object === null) throw new NotFoundError(currentFilepath)

    const objectBuffer = Buffer.isBuffer(object) ? object : Buffer.from(object as string | Uint8Array)
    retOid = await writeObject({ fs, gitdir, type: 'blob', object: objectBuffer })
  })

  return retOid
}

interface TreeEntryWithChildren {
  mode: string | number
  path: string
  oid?: string
  type: ObjectType
  children?: TreeEntryWithChildren[]
}

async function processTreeEntries({
  fs,
  dir,
  gitdir,
  entries,
  cache = {},
}: {
  fs: FsClient
  dir: string
  gitdir: string
  entries: TreeEntryWithChildren[]
  cache?: Record<string, unknown>
}): Promise<TreeEntryWithChildren[]> {
  // make sure each tree entry has valid oid
  async function processTreeEntry(entry: TreeEntryWithChildren): Promise<TreeEntryWithChildren> {
    if (entry.type === 'tree') {
      if (!entry.oid) {
        // Process children entries if the current entry is a tree
        // Use Promise.allSettled to handle partial failures gracefully
        const childrenResults = await Promise.allSettled((entry.children || []).map(processTreeEntry))
        const children = childrenResults
          .filter((result): result is PromiseFulfilledResult<TreeEntryWithChildren> => 
            result.status === 'fulfilled'
          )
          .map(result => result.value)
        
        // If any children failed, we still try to write the tree with successful children
        // This prevents one failure from blocking the entire operation
        if (childrenResults.some(result => result.status === 'rejected')) {
          const failures = childrenResults
            .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
            .map(result => result.reason)
          console.warn(`Some tree entries failed to process:`, failures)
        }
        
        // Convert children to tree format before writing
        const childrenTreeEntries = children.map(child => ({
          mode: child.mode || (child.type === 'tree' ? '040000' : '100644'),
          path: child.path!,
          oid: child.oid!,
          type: child.type || 'blob',
        }))
        
        // Write the tree with the processed children
        entry.oid = await writeTree({
          fs,
          gitdir,
          tree: childrenTreeEntries,
        })
        entry.mode = '040000' // directory
      }
    } else if (entry.type === 'blob') {
      // If OID is already set (from map function for staged files), use it directly
      // Only call checkAndWriteBlob if OID is not set (for workdir files)
      if (entry.oid) {
        // OID is already set - this is a staged file, use the OID directly
        // Ensure mode and type are set
        entry.mode = entry.mode || '100644'
        entry.type = entry.type || 'blob'
      } else {
        // OID not set - this is a workdir file, need to write blob and get OID
        const oid = await checkAndWriteBlob(
          fs,
          gitdir,
          dir,
          entry.path,
          null,
          cache
        )
        if (oid) {
          entry.oid = oid
        }
        entry.mode = entry.mode || '100644'
        entry.type = entry.type || 'blob'
      }
    }

    // remove path from entry.path (keep only filename for tree structure)
    // CRITICAL: Only modify path if it contains a directory separator
    // For root-level files, path should remain unchanged
    if (entry.path && entry.path.includes('/')) {
      entry.path = entry.path.split('/').pop() || entry.path
    }
    return entry
  }

  // Use Promise.allSettled to process all entries concurrently and handle partial failures
  // This eliminates race conditions where one failure stops all processing
  const results = await Promise.allSettled(entries.map(processTreeEntry))
  const processedEntries = results
    .filter((result): result is PromiseFulfilledResult<TreeEntryWithChildren> => 
      result.status === 'fulfilled'
    )
    .map(result => result.value)
  
  // Log any failures but continue with successful entries
  if (results.some(result => result.status === 'rejected')) {
    const failures = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason)
    console.warn(`Some entries failed to process:`, failures)
  }
  
  return processedEntries
}

export async function writeTreeChanges({
  fs,
  dir,
  gitdir,
  treePair, // [TREE({ ref: 'HEAD' }), 'STAGE'] would be the equivalent of `git write-tree`
  cache = {},
}: {
  fs: FsClient
  dir: string
  gitdir: string
  treePair: [Walker | string, Walker | string]
  cache?: Record<string, unknown>
}): Promise<string | null> {
  const isStage = treePair[1] === 'stage'
  const isWorkdir = treePair[1] === 'workdir'
  
  // CRITICAL: Get the Repository instance ONCE and pass it to _walk
  // This ensures all walkers (STAGE, TREE, WORKDIR) use the same Repository instance
  // and see the same index state as add(), status(), etc.
  // IMPORTANT: Pass gitdir to Repository.open() to ensure we get the same instance as add()
  const { Repository } = await import('../core-utils/Repository.ts')
  const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
  
  // Resolve effective gitdir from the repository (for worktree support)
  let effectiveGitdir = gitdir
  try {
    const worktree = repo.getWorktree()
    if (worktree) {
      effectiveGitdir = await worktree.getGitdir()
    } else {
      effectiveGitdir = await repo.getGitdir()
    }
  } catch {
    // If getGitdir fails, use provided gitdir
    effectiveGitdir = gitdir
  }
  
  // CRITICAL: If comparing against STAGE, ensure we read the latest index state
  // Since add() now writes directly to .git/index, the STAGE walker will read the latest state
  if (isStage) {
    await repo.readIndexDirect() // Read the owned instance (force=false by default)
  }
  
  const trees = treePair.map(t => (typeof t === 'string' ? _TreeMap[t]() : t)) as Array<{ [key: symbol]: unknown }>

  // Track whether any changes were detected
  let hasChanges = false
  // transform WalkerEntry objects into the desired format
  const map = async (filepath: string, [head, stage]: (WalkerEntry | null)[]): Promise<TreeEntry | undefined> => {
    if (
      filepath === '.' ||
      (await isIgnoredInternal({ fs, dir, gitdir, filepath }))
    ) {
      return undefined
    }

    if (isStage) {
      // For HEAD vs STAGE comparison: STAGE is the source of truth
      // We are creating a tree that represents the STAGE state
      // Therefore, if an entry exists in STAGE, we use it (regardless of whether it changed)
      // If it doesn't exist in STAGE, it was deleted, so we return undefined
      
      // Record changes for tracking purposes
      const change = await detectChange(head, stage)
      if (change.type !== 'unchanged') {
        hasChanges = true
      }
      
      // If stage exists, use it (this includes both changed and unchanged files)
      if (stage) {
        const type = await stage.type()
        if (type === 'tree' || type === 'special' || type === 'commit') {
          // For trees, we return a placeholder that will be handled by the reducer
          return {
            mode: (await stage.mode()).toString(8).padStart(6, '0'),
            path: filepath.split('/').pop() || filepath, // Use basename for tree entries
            oid: await stage.oid(),
            type: type as ObjectType,
          }
        }
        
        // It's a blob - return its properties
        // Use basename for the path (just the filename, not the full path)
        return {
          mode: (await stage.mode()).toString(8).padStart(6, '0'),
          path: filepath.split('/').pop() || filepath, // Use basename for consistency
          oid: await stage.oid(),
          type: 'blob' as const,
        }
      }
      
      // If stage is null, the file was deleted from the index
      // Record it as a change but return undefined to exclude it from the new tree
      if (head) {
        hasChanges = true
      }
      return undefined
    } else {
      // For HEAD/STAGE vs WORKDIR comparison: WORKDIR is the source of truth
      // - head = HEAD or STAGE (depending on what was passed)
      // - stage = WORKDIR (working directory state)
      // - We want to return the WORKDIR state if it exists
      
      // Record changes for tracking purposes
      const change = await detectChange(head, stage)
      if (change.type !== 'unchanged') {
        hasChanges = true
      }
      
      // If WORKDIR exists, use it (this includes both changed and unchanged files)
      if (stage) {
        const type = await stage.type()
        if (type === 'tree' || type === 'special' || type === 'commit') {
          // For trees, we return a placeholder that will be handled by the reducer
          return {
            mode: (await stage.mode()).toString(8).padStart(6, '0'),
            path: filepath.split('/').pop() || filepath, // Use basename for tree entries
            oid: await stage.oid(),
            type: type as ObjectType,
          }
        }
        
        // It's a blob - CRITICAL: Ensure the blob is written to the object database
        // WORKDIR files might not have their blobs written yet (if they were never added to index)
        // We need to write the blob to ensure it exists when the stash is applied
        const computedOid = await stage.oid()
        // Use checkAndWriteBlob to ensure the blob exists in the object database
        // This will write the blob if it doesn't exist, or return the existing OID if it does
        const actualOid = await checkAndWriteBlob(
          fs,
          effectiveGitdir,
          dir,
          filepath,
          computedOid, // Pass the computed OID - checkAndWriteBlob will verify it exists or write it
          cache
        )
        
        if (!actualOid) {
          // Blob couldn't be written - skip this file
          return undefined
        }
        
        // Return the blob properties with the actual OID from the object database
        return {
          mode: (await stage.mode()).toString(8).padStart(6, '0'),
          path: filepath.split('/').pop() || filepath, // Use basename for consistency
          oid: actualOid,
          type: 'blob',
        }
      }
      
      // If WORKDIR doesn't exist, the file was deleted
      // Record it as a change but return undefined to exclude it from the new tree
      if (head) {
        hasChanges = true
      }
      return undefined
    }
  }

  // combine mapped entries with their parent results
  const reduce = async (parent: TreeEntry | TreeEntryWithChildren | undefined, children: (TreeEntry | TreeEntryWithChildren)[]): Promise<TreeEntryWithChildren | TreeEntryWithChildren[] | undefined> => {
    // Convert children from TreeEntry to TreeEntryWithChildren
    const filteredChildren: TreeEntryWithChildren[] = children
      .filter(Boolean)
      .map(child => {
        // If already TreeEntryWithChildren, return as-is
        if ('children' in child) {
          return child as TreeEntryWithChildren
        }
        // Convert TreeEntry to TreeEntryWithChildren
        return {
          mode: child.mode,
          path: child.path,
          oid: child.oid,
          type: child.type,
        } as TreeEntryWithChildren
      })
    
    if (!parent) {
      // No parent - return array of root-level entries
      return filteredChildren.length > 0 ? filteredChildren : undefined
    } else {
      // Convert parent to TreeEntryWithChildren if needed
      const parentWithChildren: TreeEntryWithChildren = {
        mode: parent.mode,
        path: parent.path,
        oid: parent.oid,
        type: parent.type,
        children: filteredChildren.length > 0 ? filteredChildren : undefined,
      }
      return parentWithChildren
    }
  }

  // if parent is skipped, skip the children
  const iterate = async (walk: (child: (WalkerEntry | null)[]) => Promise<any>, children: (WalkerEntry | null)[][]): Promise<any[]> => {
    const filtered: (WalkerEntry | null)[][] = []
    for (const child of children) {
      const [head, stage] = child
      if (isStage) {
        // For HEAD vs STAGE comparison:
        // - Process entries where stage exists (staged files)
        // - Also process entries where head exists but stage doesn't (deletions)
        // This ensures we detect both additions/modifications and deletions
        if (stage || head) {
          // Process if either head or stage exists
          // This ensures we detect:
          // 1. Files in STAGE (staged changes)
          // 2. Files in HEAD but not in STAGE (deletions)
          filtered.push(child)
        }
      } else {
        // For HEAD/STAGE vs WORKDIR comparison:
        // - head = HEAD or STAGE
        // - stage = WORKDIR
        // We need to process all children to detect changes
        if (head || stage) {
          filtered.push(child)
        }
      }
    }
    return filtered.length ? Promise.all(filtered.map(walk)) : []
  }

  // Custom reduce function that flattens all entries into a single array
  // This is needed because the default reduce creates nested structures,
  // but writeTreeChanges needs a flat list of all changed files
  const customReduce = async (parent: TreeEntry | TreeEntryWithChildren | undefined, children: (TreeEntry | TreeEntryWithChildren)[]): Promise<TreeEntryWithChildren[]> => {
    // Flatten all children (which may themselves be arrays from nested reduces)
    // Filter out undefined/null values
    const flattenedChildren = children
      .flat()
      .filter((child): child is TreeEntryWithChildren => child !== undefined && child !== null)
    
    // If the parent is a valid entry (not undefined and not the root '.'), include it
    // The root '.' is filtered out in the map function, so parent should be undefined for root
    if (parent && parent.oid && parent.path && parent.path !== '.') {
      return [parent, ...flattenedChildren] as TreeEntryWithChildren[]
    }
    
    // Otherwise, just return the flattened children
    return flattenedChildren as TreeEntryWithChildren[]
  }

  const entries = await _walk({
    repo,
    trees,
    map,
    reduce: customReduce,
    iterate,
  }) as TreeEntryWithChildren[]

  // The `entries` variable is the flat list of TreeEntry objects for the root tree.
  // If it's empty or not an array, there are no changes.
  if (!Array.isArray(entries) || entries.length === 0) {
    return null // No changes found, return null.
  }

  // CRITICAL: If comparing HEAD vs STAGE and no changes were detected, return null immediately
  // This short-circuits tree creation when HEAD and STAGE are identical
  // This must happen BEFORE processing entries to avoid creating unnecessary trees
  if (isStage && !hasChanges) {
    return null // No changes detected - HEAD and STAGE are identical
  }

  // CRITICAL: If comparing STAGE/HEAD vs WORKDIR and no changes were detected, return null immediately
  // This short-circuits tree creation when WORKDIR is identical to the base
  // This must happen BEFORE processing entries to avoid creating unnecessary trees
  if (isWorkdir && !hasChanges) {
    return null // No changes detected - WORKDIR is identical to the base
  }
  
  // CRITICAL: For HEAD vs STAGE comparison, if entries array is empty after filtering,
  // there are no changes - return null immediately
  // This handles the case where entries exist but are all filtered out (e.g., all ignored)
  if (isStage && entries.length === 0) {
    return null // No valid entries to process
  }

  // The entries are already in the correct format from the `map` function.
  // We just need to ensure they have all required fields before writing.
  const finalTreeEntries = entries
    .filter(entry => {
      // A valid TreeEntry must have a mode, path, and oid.
      return entry && entry.mode && entry.path && entry.oid
    })
    .map(entry => {
      // Ensure mode is in the correct format (string, octal, padded)
      let mode = entry.mode
      if (typeof mode === 'number') {
        mode = mode.toString(8).padStart(6, '0')
      } else if (typeof mode === 'string') {
        // Already a string, ensure it's padded if needed
        mode = mode.padStart(6, '0')
      } else {
        // Default to blob mode if mode is missing
        mode = entry.type === 'tree' ? '040000' : '100644'
      }
      return {
        mode,
        path: entry.path,
        oid: entry.oid,
        type: entry.type || 'blob',
      }
    })

  if (finalTreeEntries.length === 0) {
    return null // No valid entries to write.
  }

  // Directly write the tree from these entries.
  const finalTreeOid = await writeTree({
    fs,
    gitdir: effectiveGitdir,
    tree: finalTreeEntries,
  })

  // CRITICAL: If the resulting tree is the empty tree OID, treat it as "no changes"
  // The empty tree OID is a special Git object that represents an empty tree
  // If we're comparing two states and they both result in an empty tree, there are no changes
  const EMPTY_TREE_OID = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
  if (finalTreeOid === EMPTY_TREE_OID) {
    return null // Empty tree means no changes
  }

  // If comparing HEAD vs STAGE, check if the final tree is identical to HEAD
  // If they're the same, return null (no changes)
  if (isStage && treePair[0] && typeof treePair[0] !== 'string') {
    try {
      // Get the HEAD tree OID from the TREE walker
      const headTree = treePair[0] as Walker
      const { GitWalkSymbol } = await import('../utils/symbols.ts')
      const headWalker = await headTree[GitWalkSymbol]({ repo })
      const headTreeOid = await headWalker.oid({ _fullpath: '.' } as any)
      
      if (finalTreeOid === headTreeOid) {
        return null // No changes - the tree is identical to HEAD
      }
    } catch {
      // If we can't get the HEAD tree OID, just return the final tree OID
      // This can happen if HEAD doesn't exist (new repository)
    }
  }

  // If comparing STAGE/HEAD vs WORKDIR, check if the final tree is identical to the base
  // If they're the same, return null (no changes)
  if (isWorkdir && treePair[0] && typeof treePair[0] !== 'string') {
    try {
      // Get the base tree OID from the TREE/STAGE walker
      const baseTree = treePair[0] as Walker
      const { GitWalkSymbol } = await import('../utils/symbols.ts')
      const baseWalker = await baseTree[GitWalkSymbol]({ repo })
      const baseTreeOid = await baseWalker.oid({ _fullpath: '.' } as any)
      
      if (finalTreeOid === baseTreeOid) {
        return null // No changes - the workdir tree is identical to the base
      }
    } catch {
      // If we can't get the base tree OID, just return the final tree OID
      // This can happen if HEAD doesn't exist (new repository)
    }
  }

  return finalTreeOid
}

export async function applyTreeChanges({
  fs,
  dir,
  gitdir,
  stashCommit,
  parentCommit,
  wasStaged,
  cache = {},
}: {
  fs: FsClient
  dir: string
  gitdir: string
  stashCommit: string
  parentCommit: string
  wasStaged: boolean
  cache?: Record<string, unknown>
}): Promise<void> {
  // Check for unmerged paths before applying tree changes
  // CRITICAL: Pass gitdir to Repository.open() to ensure we get the same Repository instance
  // as other operations like add(), status(), and stash(). This ensures index state consistency.
  const { Repository } = await import('../core-utils/Repository.ts')
  const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
  const index = await repo.readIndexDirect(false, false) // Force fresh read, allowUnmerged: false
  // If there are unmerged paths, readIndexDirect will throw UnmergedPathsError
  // This ensures we don't apply stash during a merge conflict
  
  const normalizedFs = normalizeFs(fs)
  const dirRemoved: string[] = []
  const stageUpdated: Array<{ filepath: string; oid: string; stats?: any }> = []

  // analyze the changes
  const ops = await _walk({
    repo,
    trees: [TREE({ ref: parentCommit }), TREE({ ref: stashCommit })],
    map: async (filepath: string, [parent, stash]: (WalkerEntry | null)[]): Promise<{ method: string; filepath: string; oid?: string } | undefined> => {
      if (
        filepath === '.' ||
        (await isIgnoredInternal({ fs, dir, gitdir, filepath }))
      ) {
        return undefined
      }
      const type = stash ? await stash.type() : (parent ? await parent.type() : 'blob')
      if (type !== 'tree' && type !== 'blob') {
        return undefined
      }

      // deleted tree or blob
      if (!stash && parent) {
        const method = type === 'tree' ? 'rmdir' : 'rm'
        if (type === 'tree') dirRemoved.push(filepath)
        if (type === 'blob' && wasStaged) {
          // For index deletions, we need to remove from index
          // Pass null oid to indicate deletion
          stageUpdated.push({ filepath, oid: '', stats: undefined })
        }
        return { method, filepath }
      }

      if (!stash) return undefined
      const oid = await stash.oid()
      if (!parent || (await parent.oid()) !== oid) {
        // only apply changes if changed from the parent commit or doesn't exist in the parent commit
        if (type === 'tree') {
          return { method: 'mkdir', filepath }
        } else {
          if (wasStaged) {
            // For staged changes, we need stats for the index
            // Try to get stats from the workdir first (if file exists)
            // If not, get stats from the stash tree entry (which has the mode)
            let stats: any = null
            try {
              stats = await normalizedFs.lstat(join(dir, filepath))
            } catch {
              // File doesn't exist in workdir yet - will be written later
              // Get stats from the stash tree entry instead
              stats = await stash.stat()
            }
            // If we still don't have stats, create minimal stats from the stash entry
            if (!stats) {
              const stashMode = await stash.mode()
              const stashStat = await stash.stat()
              if (stashStat) {
                stats = stashStat
              } else {
                // Fallback: create minimal stats object
                stats = {
                  mode: stashMode || 0o100644,
                  size: 0,
                  ctime: new Date(),
                  mtime: new Date(),
                }
              }
            }
            stageUpdated.push({
              filepath,
              oid,
              stats,
            })
          }
          return {
            method: 'write',
            filepath,
            oid,
          }
        }
      }
      return undefined
    },
  }) as Array<{ method: string; filepath: string; oid?: string }>

  // apply the changes to work dir
  await acquireLock('applyTreeChanges', async () => {
    for (const op of ops) {
      if (!op) continue
      const currentFilepath = join(dir, op.filepath)
      switch (op.method) {
        case 'rmdir':
          await normalizedFs.rmdir(currentFilepath)
          break
        case 'mkdir':
          await normalizedFs.mkdir(currentFilepath)
          break
        case 'rm':
          await normalizedFs.rm(currentFilepath)
          break
        case 'write':
          // only writes if file is not in the removedDirs
          if (
            !dirRemoved.some(removedDir =>
              currentFilepath.startsWith(removedDir)
            )
          ) {
            if (!op.oid) {
              // Skip if no OID provided
              break
            }
            try {
              const { object } = await readObject({
                fs,
                cache,
                gitdir,
                oid: op.oid,
              })
              // just like checkout, since mode only applicable to create, not update, delete first
              if (await normalizedFs.exists(currentFilepath)) {
                await normalizedFs.rm(currentFilepath)
              }
              const objectBuffer = Buffer.isBuffer(object) ? object : Buffer.from(object as Uint8Array)
              await normalizedFs.write(currentFilepath, objectBuffer) // only handles regular files for now
            } catch (error) {
              // If object doesn't exist, this indicates a repository integrity issue
              // The stash commit references an object that was never written or was deleted
              // This should not happen in normal operation, but we should provide a clear error
              if (error instanceof NotFoundError) {
                throw new NotFoundError(
                  `Stash commit references object ${op.oid} that does not exist in the object database. ` +
                  `This indicates a repository integrity issue. The stash cannot be applied.`
                )
              }
              throw error
            }
          }
          break
      }
    }
  })

  // update the stage (if wasStaged is true)
  if (wasStaged) {
    // Use Repository.readIndexDirect() and writeIndexDirect() for consistency
    // CRITICAL: Read index AFTER workdir changes have been applied
    // This ensures we get the correct stats for files that were just written
    const currentIndex = await repo.readIndexDirect(false) // Force fresh read
    for (const { filepath, stats, oid } of stageUpdated) {
      if (oid === '') {
        // Deletion - remove from index
        currentIndex.delete({ filepath })
      } else if (oid) {
        // Addition or modification - insert/update in index
        // Re-read stats from workdir after files have been written (more accurate)
        let finalStats = stats
        try {
          // File should exist in workdir now (was written in the acquireLock block above)
          finalStats = await normalizedFs.lstat(join(dir, filepath))
        } catch {
          // File doesn't exist - use the stats we collected earlier (from stash entry)
          // This should only happen for deletions, but we handle it gracefully
          if (!finalStats) {
            // Fallback: create minimal stats
            finalStats = {
              mode: 0o100644,
              size: 0,
              ctime: new Date(),
              mtime: new Date(),
            }
          }
        }
        currentIndex.insert({ filepath, stats: finalStats, oid })
      }
    }
    await repo.writeIndexDirect(currentIndex)
  }
}

