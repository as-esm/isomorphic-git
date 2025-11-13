import { CheckoutConflictError } from "../errors/CheckoutConflictError.ts"
import { CommitNotFetchedError } from "../errors/CommitNotFetchedError.ts"
import { NotFoundError } from "../errors/NotFoundError.ts"
import { RefManager } from "../core-utils/refs/RefManager.ts"
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
  // oldOid is defined only if onPostCheckout hook is attached
  let oldOid: string | undefined
  if (onPostCheckout) {
    try {
      oldOid = await RefManager.resolve({ fs, gitdir, ref: 'HEAD' })
    } catch (err) {
      oldOid = '0000000000000000000000000000000000000000'
    }
  }

  // Get tree oid
  let oid: string
  try {
    oid = await RefManager.resolve({ fs, gitdir, ref })
  } catch (err) {
    if (ref === 'HEAD') throw err
    // If `ref` doesn't exist, create a new remote tracking branch
    const remoteRef = `${remote}/${ref}`
    oid = await RefManager.resolve({ fs, gitdir, ref: remoteRef })
    if (track) {
      // Set up remote tracking branch
      let configBuffer = Buffer.alloc(0)
      try {
        const buffer = await fs.read(join(gitdir, 'config'))
        if (buffer && buffer !== null) {
          configBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as string | Uint8Array)
        }
      } catch (err) {
        // Config doesn't exist yet
      }
      const { ConfigAccess } = await import('../utils/configAccess.ts')
      const configAccess = new ConfigAccess(fs, gitdir)
      await configAccess.setConfigValue(`branch.${ref}.remote`, remote, 'local')
      await configAccess.setConfigValue(`branch.${ref}.merge`, `refs/heads/${ref}`, 'local')
    }
    // Create a new branch that points at that same commit
    await RefManager.writeRef({
      fs,
      gitdir,
      ref: `refs/heads/${ref}`,
      value: oid,
    })
  }

  // Get commit to get tree OID
  const { object: commitObject } = await ObjectReader.read({ fs, cache, gitdir, oid })
  const commit = parseCommit(commitObject)
  const treeOid = commit.tree

  // Load sparse checkout patterns if enabled
  let sparsePatterns: string[] | null = null
  try {
    sparsePatterns = await SparseCheckoutManager.loadPatterns({ fs, gitdir })
    if (sparsePatterns.length === 0) {
      sparsePatterns = null
    }
  } catch (err) {
    // Sparse checkout not enabled
  }

  // Update working dir
  if (!noCheckout) {
    try {
      if (dryRun) {
        // Just analyze, don't execute
        const operations = await WorkdirManager.analyzeCheckout({
          fs,
          dir,
          gitdir,
          treeOid,
          filepaths,
          force,
          sparsePatterns,
          cache,
        })
        const conflicts = operations.filter(op => op[0] === 'conflict').map(op => op[1])
        if (conflicts.length > 0) {
          throw new CheckoutConflictError(conflicts)
        }
      } else {
        await WorkdirManager.checkout({
          fs,
          dir,
          gitdir,
          treeOid,
          filepaths,
          force,
          sparsePatterns,
          cache,
          onProgress,
        })
      }
    } catch (err) {
      if (err instanceof NotFoundError && err.data && err.data.what === oid) {
        throw new CommitNotFetchedError(ref, oid)
      } else {
        throw err
      }
    }

    if (onPostCheckout) {
      await onPostCheckout({
        previousHead: oldOid || '0000000000000000000000000000000000000000',
        newHead: oid,
        type: filepaths != null && filepaths.length > 0 ? 'file' : 'branch',
      })
    }
  }

  // Update HEAD
  if (!noUpdateHead) {
    // Try to resolve as branch first
    try {
      const branchOid = await RefManager.resolve({ fs, gitdir, ref: `refs/heads/${ref}` })
      if (branchOid === oid) {
        // It's a branch
        await RefManager.writeSymbolicRef({
          fs,
          gitdir,
          ref: 'HEAD',
          value: `refs/heads/${ref}`,
        })
      } else {
        // detached head
        await RefManager.writeRef({ fs, gitdir, ref: 'HEAD', value: oid })
      }
    } catch (err) {
      // Not a branch, use as detached head
      await RefManager.writeRef({ fs, gitdir, ref: 'HEAD', value: oid })
    }
  }
}

