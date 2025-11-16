import { CheckoutConflictError } from "../errors/CheckoutConflictError.ts"
import { CommitNotFetchedError } from "../errors/CommitNotFetchedError.ts"
import { NotFoundError } from "../errors/NotFoundError.ts"
// RefManager import removed - using Repository.resolveRef/writeRef methods instead
import { WorkdirManager } from "../core-utils/filesystem/WorkdirManager.ts"
import { SparseCheckoutManager } from "../core-utils/filesystem/SparseCheckoutManager.ts"
import { readObject } from "../git/objects/readObject.ts"
import { parse as parseCommit } from "../core-utils/parsers/Commit.ts"
import { parse as parseConfig, serialize as serializeConfig } from "../core-utils/ConfigParser.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { ProgressCallback } from "../managers/GitRemoteHTTP.ts"

// ============================================================================
// CHECKOUT TYPES
// ============================================================================

/**
 * Post-checkout hook parameters
 */
export type PostCheckoutParams = {
  previousHead: string // SHA-1 object id of HEAD before checkout
  newHead: string // SHA-1 object id of HEAD after checkout
  type: 'branch' | 'file' // Flag determining whether a branch or set of files was checked
}

/**
 * Post-checkout callback
 */
export type PostCheckoutCallback = (args: PostCheckoutParams) => void | Promise<void>

/**
 * Checkout a branch
 *
 * If the branch already exists it will check out that branch. Otherwise, it will create a new remote tracking branch set to track the remote branch of that name.
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {ProgressCallback} [args.onProgress] - optional progress event callback
 * @param {PostCheckoutCallback} [args.onPostCheckout] - optional post-checkout hook callback
 * @param {string} args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.ref = 'HEAD'] - Source to checkout files from
 * @param {string[]} [args.filepaths] - Limit the checkout to the given files and directories
 * @param {string} [args.remote = 'origin'] - Which remote repository to use
 * @param {boolean} [args.noCheckout = false] - If true, will update HEAD but won't update the working directory
 * @param {boolean} [args.noUpdateHead] - If true, will update the working directory but won't update HEAD. Defaults to `false` when `ref` is provided, and `true` if `ref` is not provided.
 * @param {boolean} [args.dryRun = false] - If true, simulates a checkout so you can test whether it would succeed.
 * @param {boolean} [args.force = false] - If true, conflicts will be ignored and files will be overwritten regardless of local changes.
 * @param {boolean} [args.track = true] - If false, will not set the remote branch tracking information. Defaults to true.
 * @param {object} [args.cache] - a [cache](cache.md) object
 * @param {boolean} [args.nonBlocking = false] - If true, will use non-blocking file system operations to allow for better performance in certain environments (For example, in Browsers)
 * @param {number} [args.batchSize = 100] - If args.nonBlocking is true, batchSize is the number of files to process at a time avoid blocking the executing thread. The default value of 100 is a good starting point.
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * // switch to the main branch
 * await git.checkout({
 *   fs,
 *   dir: '/tutorial',
 *   ref: 'main'
 * })
 * console.log('done')
 *
 * @example
 * // restore the 'docs' and 'src/docs' folders to the way they were, overwriting any changes
 * await git.checkout({
 *   fs,
 *   dir: '/tutorial',
 *   force: true,
 *   filepaths: ['docs', 'src/docs']
 * })
 * console.log('done')
 *
 * @example
 * // restore the 'docs' and 'src/docs' folders to the way they are in the 'develop' branch, overwriting any changes
 * await git.checkout({
 *   fs,
 *   dir: '/tutorial',
 *   ref: 'develop',
 *   noUpdateHead: true,
 *   force: true,
 *   filepaths: ['docs', 'src/docs']
 * })
 * console.log('done')
 */
export async function checkout({
  repo: _repo,
  fs: _fs,
  onProgress,
  onPostCheckout,
  dir,
  gitdir = join(dir, '.git'),
  remote = 'origin',
  ref: _ref,
  filepaths,
  noCheckout = false,
  noUpdateHead = _ref === undefined,
  dryRun = false,
  force = false,
  track = true,
  cache = {},
  nonBlocking = false,
  batchSize = 100,
}: {
  repo?: import('../core-utils/Repository.ts').Repository
  fs?: FsClient
  onProgress?: ProgressCallback
  onPostCheckout?: PostCheckoutCallback
  dir?: string
  gitdir?: string
  remote?: string
  ref?: string
  filepaths?: string[]
  noCheckout?: boolean
  noUpdateHead?: boolean
  dryRun?: boolean
  force?: boolean
  track?: boolean
  cache?: Record<string, unknown>
  nonBlocking?: boolean
  batchSize?: number
}): Promise<void> {
  try {
    // CRITICAL: If repo is provided, use it directly to ensure fs instance consistency
    // Otherwise, create a new Repository instance (backward compatibility)
    let repo: import('../core-utils/Repository.ts').Repository
    let fs: FsClient
    let effectiveDir: string
    let effectiveGitdir: string

    if (_repo) {
      repo = _repo
      fs = repo.fs
      effectiveDir = repo.dir || dir || ''
      effectiveGitdir = await repo.getGitdir()
    } else {
      if (!_fs) {
        throw new Error('Either repo or fs must be provided')
      }
      if (!dir) {
        throw new Error('dir is required when repo is not provided')
      }
      fs = _fs
      effectiveDir = dir
      effectiveGitdir = gitdir || join(dir, '.git')
      
      // Use Repository to get worktree context
      // This ensures checkout uses the correct worktree's gitdir and staging area
      const { Repository } = await import('../core-utils/Repository.ts')
      repo = await Repository.open({ fs, dir: effectiveDir, gitdir: effectiveGitdir, cache, autoDetectConfig: true })
      effectiveGitdir = await repo.getGitdir()
    }

    const ref = _ref || 'HEAD'
    
    // If repo is provided, use repo.checkout() directly for maximum consistency
    if (_repo) {
      return await repo.checkout(ref, {
        filepaths,
        force,
        noCheckout,
        noUpdateHead,
        dryRun,
        remote,
        track,
        onProgress,
      })
    }
    
    // Otherwise, use _checkout for backward compatibility
    return await _checkout({
      fs: normalizeFs(fs) as any,
      cache,
      onProgress,
      onPostCheckout,
      dir: effectiveDir,
      gitdir: effectiveGitdir,
      remote,
      ref,
      filepaths,
      noCheckout,
      noUpdateHead,
      dryRun,
      force,
      track,
      nonBlocking,
      batchSize,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.checkout'
    throw err
  }
}

/**
 * Internal checkout implementation
 * @internal - Exported for use by other commands (e.g., clone, pull)
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
  // CRITICAL: Pass gitdir to Repository.open() to ensure we use the same gitdir where refs were written
  const { Repository } = await import('../core-utils/Repository.ts')
  const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
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
    if (ref === 'HEAD') {
      // HEAD doesn't exist - try to find default branch
      let defaultBranch = 'master'
      try {
        const { ConfigAccess } = await import('../utils/configAccess.ts')
        const configAccess = new ConfigAccess(fs, worktreeGitdir)
        const initDefaultBranch = await configAccess.getConfigValue('init.defaultBranch')
        if (initDefaultBranch && typeof initDefaultBranch === 'string') {
          defaultBranch = initDefaultBranch
        }
      } catch {
        // Config doesn't exist or can't be read, use 'master'
      }
      
      // Try to resolve the default branch
      try {
        oid = await repo.resolveRef(`refs/heads/${defaultBranch}`)
        // Set HEAD to point to the default branch
        await repo.writeSymbolicRefDirect('HEAD', `refs/heads/${defaultBranch}`)
      } catch {
        // Default branch doesn't exist - try to list branches and use the first one
        try {
          const { listRefs } = await import('../git/refs/listRefs.ts')
          const branches = await listRefs({ fs, gitdir: worktreeGitdir, filepath: 'refs/heads' })
          if (branches.length > 0) {
            // Use the first branch
            const firstBranch = branches[0].replace('refs/heads/', '')
            oid = await repo.resolveRef(`refs/heads/${firstBranch}`)
            // Set HEAD to point to the first branch
            await repo.writeSymbolicRefDirect('HEAD', `refs/heads/${firstBranch}`)
          } else {
            // No branches exist, can't checkout HEAD
            throw err
          }
        } catch {
          // Can't find any branches, re-throw original error
          throw err
        }
      }
    } else {
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

