import { CheckoutConflictError } from "../errors/CheckoutConflictError.ts"
import { CommitNotFetchedError } from "../errors/CommitNotFetchedError.ts"
import { NotFoundError } from "../errors/NotFoundError.ts"
// RefManager import removed - using Repository.resolveRef/writeRef methods instead
import { WorkdirManager } from "../core-utils/filesystem/WorkdirManager.ts"
import { SparseCheckoutManager } from "../core-utils/filesystem/SparseCheckoutManager.ts"
import { ObjectReader } from "../core-utils/odb/ObjectReader.ts"
import { parse as parseCommit } from "../core-utils/parsers/Commit.ts"
import { parse as parseIndex, serialize as serializeIndex } from "../core-utils/index/Index.ts"
import { parse as parseConfig, serialize as serializeConfig } from "../core-utils/ConfigParser.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { ProgressCallback } from "../managers/GitRemoteHTTP.ts"
import type { PostCheckoutCallback } from '../api/checkout.ts'

/**
 * Checkout a branch or commit
 */
export async function _checkout({
  fs,
  cache,
  onProgress,
  onPostCheckout,
  dir,
  gitdir,
  remote,
  ref,
  filepaths,
  noCheckout,
  noUpdateHead,
  dryRun,
  force,
  track = true,
  nonBlocking = false,
  batchSize = 100,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  onProgress?: ProgressCallback
  onPostCheckout?: PostCheckoutCallback
  dir: string
  gitdir: string
  remote: string
  ref: string
  filepaths?: string[]
  noCheckout: boolean
  noUpdateHead?: boolean
  dryRun?: boolean
  force?: boolean
  track?: boolean
  nonBlocking?: boolean
  batchSize?: number
}): Promise<void> {
  // Use Repository to get worktree context
  const { Repository } = await import('../core-utils/Repository.ts')
  const repo = await Repository.open({ fs, dir, cache, autoDetectConfig: true })
  const worktree = repo.getWorktree()
  
  if (!worktree) {
    throw new Error('Cannot checkout in bare repository')
  }
  
  // Get worktree's gitdir (may differ from provided gitdir for linked worktrees)
  const worktreeGitdir = await worktree.getGitdir()
  
  // oldOid is defined only if onPostCheckout hook is attached
  let oldOid: string | undefined
  if (onPostCheckout) {
    try {
      oldOid = await repo.resolveRef('HEAD')
    } catch (err) {
      oldOid = '0000000000000000000000000000000000000000'
    }
  }
  
  // Resolve ref to get oid for post-checkout hook
  let oid: string
  try {
    oid = await repo.resolveRef(ref)
  } catch (err) {
    if (ref === 'HEAD') throw err
    // If `ref` doesn't exist, try to create a new remote tracking branch
    const remoteRef = `${remote}/${ref}`
    try {
      oid = await repo.resolveRef(remoteRef)
      if (track) {
        // Set up remote tracking branch
        const { ConfigAccess } = await import('../utils/configAccess.ts')
        const configAccess = new ConfigAccess(fs, worktreeGitdir)
        await configAccess.setConfigValue(`branch.${ref}.remote`, remote, 'local')
        await configAccess.setConfigValue(`branch.${ref}.merge`, `refs/heads/${ref}`, 'local')
      }
      // Create a new branch that points at that same commit
      await repo.writeRef(`refs/heads/${ref}`, oid)
    } catch {
      throw err
    }
  }

  // Use worktree.checkout() which handles ref resolution, HEAD update, and workdir checkout
  // This ensures all operations use the worktree's gitdir and staging area
  try {
    await worktree.checkout(ref, {
      filepaths,
      force,
      noCheckout,
      noUpdateHead,
      dryRun,
      remote,
      track,
      onProgress,
    })
  } catch (err) {
    if (err instanceof NotFoundError && (err as any).data && (err as any).data.what === oid) {
      throw new CommitNotFetchedError(ref, oid)
    }
    throw err
  }

  // Call post-checkout hook if provided
  if (onPostCheckout) {
    await onPostCheckout({
      previousHead: oldOid || '0000000000000000000000000000000000000000',
      newHead: oid,
      type: filepaths != null && filepaths.length > 0 ? 'file' : 'branch',
    })
  }
}

