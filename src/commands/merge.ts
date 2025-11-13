import { _commit } from './commit.js'
import { _currentBranch } from './currentBranch.js'
import { FastForwardError } from '../errors/FastForwardError.js'
import { MergeConflictError } from '../errors/MergeConflictError.js'
import { MergeNotSupportedError } from '../errors/MergeNotSupportedError.js'
import { RefManager } from '../core-utils/refs/RefManager.js'
import { findMergeBase } from '../core-utils/algorithms/CommitGraphWalker.js'
import { mergeTrees } from '../core-utils/algorithms/MergeManager.js'
import { parse as parseIndex, serialize as serializeIndex } from '../core-utils/index/Index.js'
import { parse as parseCommit } from '../core-utils/parsers/Commit.js'
import { read as readObject } from '../core-utils/odb/ObjectReader.js'
import { Repository } from '../core-utils/Repository.js'
import { abbreviateRef } from '../utils/abbreviateRef.js'
import { join } from '../utils/join.js'
import AsyncLock from 'async-lock'
import type { FsClient } from '../models/FileSystem.js'
import type { Author, CommitObject } from '../models/GitCommit.js'
import type { SignCallback } from '../core-utils/Signing.js'
import type { MergeResult } from '../api/merge.js'

let indexLock: AsyncLock | undefined

/**
 * Merges two branches
 */
export async function _merge({
  fs: _fs,
  cache: _cache,
  dir,
  gitdir: _gitdir,
  ours,
  theirs,
  fastForward = true,
  fastForwardOnly = false,
  dryRun = false,
  noUpdateBranch = false,
  abortOnConflict = true,
  message,
  author,
  committer,
  signingKey,
  onSign,
  allowUnrelatedHistories = false,
  repo,
}: {
  fs?: FsClient
  cache?: Record<string, unknown>
  dir?: string
  gitdir?: string
  ours?: string
  theirs: string
  fastForward?: boolean
  fastForwardOnly?: boolean
  dryRun?: boolean
  noUpdateBranch?: boolean
  abortOnConflict?: boolean
  message?: string
  author?: Partial<Author>
  committer?: Partial<Author>
  signingKey?: string
  onSign?: SignCallback
  allowUnrelatedHistories?: boolean
  repo?: Repository
}): Promise<MergeResult> {
  // Extract parameters from Repository if provided
  const fs = repo?.fs || _fs!
  const cache = repo?.cache || _cache || {}
  const gitdir = _gitdir || (repo ? await repo.getGitdir() : undefined)
  
  if (!fs) throw new Error('fs is required')
  if (!gitdir) throw new Error('gitdir is required')
  if (ours === undefined) {
    ours = await _currentBranch({ fs, gitdir, fullname: true })
  }
  
  // Expand refs
  if (ours) {
    ours = await RefManager.expand({ fs, gitdir, ref: ours })
  }
  theirs = await RefManager.expand({ fs, gitdir, ref: theirs })
  
  const ourOid = await RefManager.resolve({
    fs,
    gitdir,
    ref: ours,
  })
  const theirOid = await RefManager.resolve({
    fs,
    gitdir,
    ref: theirs,
  })
  
  // Find most recent common ancestor
  const baseOids = await findMergeBase({
    fs,
    cache,
    gitdir,
    commits: [ourOid, theirOid],
  })
  
  if (baseOids.length !== 1) {
    if (baseOids.length === 0 && allowUnrelatedHistories) {
      // 4b825…  == the empty tree used by git
      baseOids.push('4b825dc642cb6eb9a060e54bf8d69288fbee4904')
    } else {
      // TODO: Recursive Merge strategy
      throw new MergeNotSupportedError()
    }
  }
  const baseOid = baseOids[0]
  
  // Handle fast-forward case
  if (baseOid === theirOid) {
    return {
      oid: ourOid,
      alreadyMerged: true,
    }
  }
  
  if (fastForward && baseOid === ourOid) {
    if (!dryRun && !noUpdateBranch) {
      await RefManager.writeRef({ fs, gitdir, ref: ours, value: theirOid })
    }
    return {
      oid: theirOid,
      fastForward: true,
    }
  } else {
    // Not a simple fast-forward
    if (fastForwardOnly) {
      throw new FastForwardError()
    }
    
    // Get tree OIDs from commits
    const ourCommitResult = await readObject({ fs, cache, gitdir, oid: ourOid, format: 'content' })
    const theirCommitResult = await readObject({ fs, cache, gitdir, oid: theirOid, format: 'content' })
    const baseCommitResult = await readObject({ fs, cache, gitdir, oid: baseOid, format: 'content' })
    
    if (ourCommitResult.type !== 'commit' || theirCommitResult.type !== 'commit' || baseCommitResult.type !== 'commit') {
      throw new Error('Expected commit objects')
    }
    
    const ourCommit = parseCommit(ourCommitResult.object) as CommitObject
    const theirCommit = parseCommit(theirCommitResult.object) as CommitObject
    const baseCommit = parseCommit(baseCommitResult.object) as CommitObject
    
    const ourTreeOid = ourCommit.tree || '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
    const theirTreeOid = theirCommit.tree || '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
    const baseTreeOid = baseCommit.tree || '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
    
    // Perform three-way merge
    const mergeResult = await mergeTrees({
      fs,
      cache,
      gitdir,
      base: baseTreeOid,
      ours: ourTreeOid,
      theirs: theirTreeOid,
    })
    
    // Check for conflicts
    if (mergeResult.conflicts.length > 0) {
      if (abortOnConflict) {
        throw new MergeConflictError(mergeResult.conflicts)
      }
      // If not aborting, we still need to update the index with conflict markers
      // For now, throw the error - full conflict handling would require updating the index
      throw new MergeConflictError(mergeResult.conflicts)
    }
    
    // Update index with merged tree
    if (!indexLock) {
      indexLock = new AsyncLock({ maxPending: Infinity })
    }
    
    const indexPath = join(gitdir, 'index')
    await indexLock.acquire(indexPath, async () => {
      // Read current index
      let indexBuffer = Buffer.alloc(0)
      try {
        const indexData = await fs.read(indexPath)
        indexBuffer = Buffer.isBuffer(indexData) ? indexData : Buffer.from(indexData as string | Uint8Array)
      } catch {
        // Index doesn't exist
      }
      
      const index = await parseIndex(indexBuffer)
      
      // Note: In a full implementation, we would update index entries based on the merged tree:
      // 1. Read the merged tree OID
      // 2. Recursively walk the tree and update index entries
      // 3. Remove entries that are no longer in the tree
      // 4. Add new entries from the tree
      // 5. Mark conflict entries appropriately (stage 1, 2, 3)
      // For now, the index will be updated when the commit is made via _commit()
      
      const updatedIndex = await serializeIndex(index)
      await fs.write(indexPath, updatedIndex)
    })
    
    if (!message) {
      message = `Merge branch '${abbreviateRef(theirs)}' into ${abbreviateRef(ours)}`
    }
    
    const oid = await _commit({
      fs,
      cache,
      gitdir,
      message,
      ref: ours,
      tree: mergeResult.mergedTreeOid,
      parent: [ourOid, theirOid],
      author,
      committer,
      signingKey,
      onSign,
      dryRun,
      noUpdateBranch,
    })
    
    return {
      oid,
      tree: mergeResult.mergedTreeOid,
      mergeCommit: true,
    }
  }
}

