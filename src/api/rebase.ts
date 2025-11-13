import { RefManager } from '../core-utils/refs/RefManager.js'
import { read as readObject } from '../core-utils/odb/ObjectReader.js'
import { write as writeObject } from '../core-utils/odb/ObjectWriter.js'
import { parse as parseCommit, serialize as serializeCommit } from '../core-utils/parsers/Commit.js'
import { mergeTrees } from '../core-utils/algorithms/MergeManager.js'
import { findMergeBase } from '../core-utils/algorithms/CommitGraphWalker.js'
import { topologicalSort } from '../core-utils/algorithms/CommitGraphWalker.js'
import {
  isRebaseInProgress,
  initRebase,
  nextRebaseCommand,
  readRebaseOnto,
  readRebaseHead,
  completeRebase,
  abortRebase,
} from '../core-utils/algorithms/SequencerManager.js'
import { StateManager } from '../core-utils/StateManager.js'
import { assertParameter } from '../utils/assertParameter.js'
import { join } from '../utils/join.js'
import type { FsClient } from '../models/FileSystem.js'
import type { CommitObject } from '../models/GitCommit.js'

// ============================================================================
// REBASE TYPES
// ============================================================================

/**
 * Rebase operation result
 */
export type RebaseResult = {
  oid: string
  conflicts?: string[]
}

/**
 * Re-applies commits on top of another base tip
 * Similar to `git rebase`
 */
export async function rebase({
  fs,
  dir,
  gitdir = join(dir, '.git'),
  upstream,
  branch,
  interactive = false,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  upstream: string
  branch?: string
  interactive?: boolean
  cache?: Record<string, unknown>
}): Promise<RebaseResult> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir)
    assertParameter('upstream', upstream)

    // Check if rebase is already in progress
    if (await isRebaseInProgress({ fs, gitdir })) {
      // Continue existing rebase
      return await continueRebase({ fs, gitdir, cache })
    }

    // Resolve upstream to OID
    const upstreamOid = await RefManager.resolve({ fs, gitdir, ref: upstream })

    // Get current branch or specified branch
    let currentBranch: string
    let currentHead: string
    if (branch) {
      currentBranch = branch
      currentHead = await RefManager.resolve({ fs, gitdir, ref: branch })
    } else {
      // Get current branch from HEAD
      const headRef = await RefManager.resolve({ fs, gitdir, ref: 'HEAD', depth: 2 })
      if (headRef.startsWith('ref: ')) {
        currentBranch = headRef.slice('ref: '.length)
        currentHead = await RefManager.resolve({ fs, gitdir, ref: currentBranch })
      } else {
        // Detached HEAD
        currentHead = headRef
        currentBranch = 'HEAD'
      }
    }

    // Find merge base
    const mergeBases = await findMergeBase({
      fs,
      cache,
      gitdir,
      commits: [currentHead, upstreamOid],
    })

    if (mergeBases.length === 0) {
      throw new Error('No common ancestor found between branches')
    }
    const baseOid = mergeBases[0]

    // Get commits to rebase (commits in current branch but not in upstream)
    // This is commits reachable from currentHead but not from upstreamOid
    const commitsToRebase = await getCommitsToRebase({
      fs,
      cache,
      gitdir,
      from: currentHead,
      to: baseOid,
    })

    if (commitsToRebase.length === 0) {
      // Already up to date
      return { oid: currentHead }
    }

    // Initialize rebase sequencer
    await initRebase({
      fs,
      gitdir,
      headName: currentBranch,
      onto: upstreamOid,
      commands: commitsToRebase.map(commit => ({
        action: 'pick',
        oid: commit.oid,
        message: commit.message,
      })),
    })

    // Save ORIG_HEAD
    const stateManager = new StateManager(fs, gitdir)
    await stateManager.setOrigHead(currentHead)

    // Reset branch to upstream
    await RefManager.writeRef({ fs, gitdir, ref: currentBranch, value: upstreamOid })

    // Apply each commit
    let lastOid = upstreamOid
    const conflicts: string[] = []

    for (const commit of commitsToRebase) {
      // Apply commit using cherry-pick logic
      const result = await applyRebaseCommit({
        fs,
        cache,
        gitdir,
        commitOid: commit.oid,
        baseOid: commit.parent[0] || baseOid,
        ontoOid: lastOid,
      })

      if (result.conflicts && result.conflicts.length > 0) {
        conflicts.push(...result.conflicts)
        // Stop on first conflict
        break
      }

      lastOid = result.oid
    }

    if (conflicts.length > 0) {
      // Rebase in progress, conflicts need to be resolved
      return {
        oid: lastOid,
        conflicts,
      }
    }

    // Update branch to final commit
    await RefManager.writeRef({ fs, gitdir, ref: currentBranch, value: lastOid })

    // Complete rebase
    await completeRebase({ fs, gitdir })

    return {
      oid: lastOid,
    }
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.rebase'
    throw err
  }
}

/**
 * Continues an in-progress rebase
 */
async function continueRebase({
  fs,
  gitdir,
  cache,
}: {
  fs: FsClient
  gitdir: string
  cache: Record<string, unknown>
}): Promise<RebaseResult> {
  const ontoOid = await readRebaseOnto({ fs, gitdir })
  if (!ontoOid) {
    throw new Error('Rebase sequencer not properly initialized')
  }

  const headName = await readRebaseHead({ fs, gitdir })
  if (!headName) {
    throw new Error('Rebase head not found')
  }

  // Get current HEAD
  const currentHead = await RefManager.resolve({ fs, gitdir, ref: 'HEAD' })

  // Continue with next command
  const command = await nextRebaseCommand({ fs, gitdir })
  if (!command) {
    // Rebase complete
    await completeRebase({ fs, gitdir })
    return { oid: currentHead }
  }

  // Apply the commit
  const commitResult = await readObject({ fs, cache, gitdir, oid: command.oid, format: 'content' })
  if (commitResult.type !== 'commit') {
    throw new Error(`Object ${command.oid} is not a commit`)
  }
  const commitObj = parseCommit(commitResult.object) as CommitObject

  const baseOid = commitObj.parent && commitObj.parent.length > 0 ? commitObj.parent[0] : ontoOid

  const result = await applyRebaseCommit({
    fs,
    cache,
    gitdir,
    commitOid: command.oid,
    baseOid,
    ontoOid: currentHead,
  })

  if (result.conflicts && result.conflicts.length > 0) {
    return {
      oid: result.oid,
      conflicts: result.conflicts,
    }
  }

  // Update HEAD
  await RefManager.writeRef({ fs, gitdir, ref: 'HEAD', value: result.oid })

  // Continue with next commit
  return await continueRebase({ fs, gitdir, cache })
}

/**
 * Applies a single commit during rebase (similar to cherry-pick)
 */
async function applyRebaseCommit({
  fs,
  cache,
  gitdir,
  commitOid,
  baseOid,
  ontoOid,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  commitOid: string
  baseOid: string
  ontoOid: string
}): Promise<{ oid: string; conflicts?: string[] }> {
  // Read the commit to apply
  const commitResult = await readObject({ fs, cache, gitdir, oid: commitOid, format: 'content' })
  if (commitResult.type !== 'commit') {
    throw new Error(`Object ${commitOid} is not a commit`)
  }
  const commitObj = parseCommit(commitResult.object) as CommitObject

  // Read onto commit
  const ontoResult = await readObject({ fs, cache, gitdir, oid: ontoOid, format: 'content' })
  if (ontoResult.type !== 'commit') {
    throw new Error(`Object ${ontoOid} is not a commit`)
  }
  const ontoCommit = parseCommit(ontoResult.object) as CommitObject

  // Read base commit
  const baseResult = await readObject({ fs, cache, gitdir, oid: baseOid, format: 'content' })
  if (baseResult.type !== 'commit') {
    throw new Error(`Object ${baseOid} is not a commit`)
  }
  const baseCommit = parseCommit(baseResult.object) as CommitObject

  // Get tree OIDs
  const ourTreeOid = ontoCommit.tree || '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
  const baseTreeOid = baseCommit.tree || '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
  const theirTreeOid = commitObj.tree || '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

  // Perform three-way merge
  const mergeResult = await mergeTrees({
    fs,
    cache,
    gitdir,
    base: baseTreeOid,
    ours: ourTreeOid,
    theirs: theirTreeOid,
  })

  if (mergeResult.conflicts.length > 0) {
    // Return the onto commit OID (no new commit created)
    return {
      oid: ontoOid,
      conflicts: mergeResult.conflicts,
    }
  }

  // Create new commit with merged tree
  const newCommit: CommitObject = {
    tree: mergeResult.mergedTreeOid,
    parent: [ontoOid],
    author: commitObj.author,
    committer: commitObj.committer,
    message: commitObj.message,
  }

  // Write commit object
  const commitBuffer = serializeCommit(newCommit)
  const newCommitOid = await writeObject({
    fs,
    gitdir,
    type: 'commit',
    object: commitBuffer,
    format: 'content',
  })

  return {
    oid: newCommitOid,
  }
}

/**
 * Gets commits to rebase (commits in 'from' but not in 'to')
 */
async function getCommitsToRebase({
  fs,
  cache,
  gitdir,
  from,
  to,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  from: string
  to: string
}): Promise<Array<{ oid: string; message: string; parent: string[] }>> {
  // Get all commits reachable from 'from'
  const fromCommits = await topologicalSort({
    fs,
    cache,
    gitdir,
    heads: [from],
  })

  // Get all commits reachable from 'to'
  const toCommits = new Set(
    await topologicalSort({
      fs,
      cache,
      gitdir,
      heads: [to],
    })
  )

  // Filter to commits in 'from' but not in 'to'
  // topologicalSort returns oldest first, which is what we want for rebasing
  const commitsToRebase: Array<{ oid: string; message: string; parent: string[] }> = []

  for (const oid of fromCommits) {
    if (!toCommits.has(oid)) {
      const commitResult = await readObject({ fs, cache, gitdir, oid, format: 'content' })
      if (commitResult.type === 'commit') {
        const commit = parseCommit(commitResult.object) as CommitObject
        commitsToRebase.push({
          oid,
          message: commit.message,
          parent: commit.parent || [],
        })
      }
    }
  }

  // topologicalSort already returns oldest first, which is correct for rebasing
  return commitsToRebase
}

