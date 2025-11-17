// RefManager import removed - using Repository.resolveRef/writeRef methods instead
import { WorkdirManager } from './filesystem/WorkdirManager.ts'
import { readObject } from '../git/objects/readObject.ts'
import { parse as parseCommit } from './parsers/Commit.ts'
import { SparseCheckoutManager } from './filesystem/SparseCheckoutManager.ts'
import { CheckoutConflictError } from '../errors/CheckoutConflictError.ts'
// StagingArea removed - use Repository.readIndexDirect/writeIndexDirect directly
import type { Repository } from './Repository.ts'
import type { ProgressCallback } from '../git/remote/GitRemoteHTTP.ts'

/**
 * Worktree - Represents a working tree (linked worktrees support)
 * Encapsulates the working directory and its associated git directory
 * Each worktree has its own staging area (index) and cache context
 */
export class Worktree {
  private readonly repo: Repository
  public readonly dir: string
  private _gitdir: string | null
  private _name: string | null
  // StagingArea removed - Worktree is now stateless, delegates to Repository

  constructor(
    repo: Repository,
    dir: string,
    gitdir: string | null = null,
    name: string | null = null
  ) {
    this.repo = repo
    this.dir = dir
    this._gitdir = gitdir
    this._name = name
  }

  /**
   * Gets the Repository instance this worktree belongs to
   */
  get repository(): Repository {
    return this.repo
  }

  /**
   * Gets the git directory for this worktree
   * For main worktree: returns main repo's .git
   * For linked worktree: returns .git/worktrees/<name>
   */
  async getGitdir(): Promise<string> {
    if (this._gitdir) {
      return this._gitdir
    }
    // Resolve from repository
    this._gitdir = await this.repo.getGitdir()
    return this._gitdir
  }

  /**
   * Gets the git directory as a property
   */
  get gitdir(): Promise<string> {
    return this.getGitdir()
  }

  /**
   * Gets the worktree name
   * Returns null for the main worktree
   */
  getName(): string | null {
    return this._name
  }

  /**
   * Checks if this is the main worktree
   */
  async isMain(): Promise<boolean> {
    const mainGitdir = await this.repo.getGitdir()
    const worktreeGitdir = await this.getGitdir()
    return worktreeGitdir === mainGitdir
  }

  /**
   * Gets the staging area (index) for this worktree
   * Each worktree has its own staging area bound to its gitdir
   * 
   * @deprecated Use Repository.readIndexDirect/writeIndexDirect directly with worktree's gitdir
   * This method is kept for backward compatibility but delegates to Repository methods.
   */
  async getStagingArea(): Promise<{ read: () => Promise<import('../git/index/GitIndex.ts').GitIndex>, write: (index?: import('../git/index/GitIndex.ts').GitIndex) => Promise<void> }> {
    const gitdir = await this.getGitdir()
    // Return a simple object that delegates to Repository methods
    return {
      read: async () => {
        // Use the worktree's gitdir for index operations
        return await this.repo.readIndexDirect(false, true, gitdir)
      },
      write: async (index?: import('../git/index/GitIndex.ts').GitIndex) => {
        if (index) {
          await this.repo.writeIndexDirect(index, gitdir)
        } else {
          const currentIndex = await this.repo.readIndexDirect(false, true, gitdir)
          await this.repo.writeIndexDirect(currentIndex, gitdir)
        }
      }
    }
  }

  /**
   * Checks out a branch, tag, or commit in this worktree
   * Updates HEAD, working directory, and index
   * 
   * @param ref - Branch name, tag name, or commit SHA
   * @param options - Checkout options
   */
  async checkout(
    ref: string,
    options: {
      filepaths?: string[]
      force?: boolean
      noCheckout?: boolean
      noUpdateHead?: boolean
      dryRun?: boolean
      sparsePatterns?: string[]
      onProgress?: ProgressCallback
      remote?: string
      track?: boolean
      oldOid?: string // Optional old HEAD OID for reflog (from checkout command)
    } = {}
  ): Promise<void> {
    const gitdir = await this.getGitdir()
    const {
      filepaths,
      force = false,
      noCheckout = false,
      noUpdateHead = false,
      dryRun = false,
      sparsePatterns,
      onProgress,
      remote = 'origin',
      track = true,
      oldOid: providedOldOid,
    } = options

    // Resolve ref to commit OID using Repository methods
    let oid: string
    let createdFromRemote = false
    try {
      // First check if it exists as a local branch (refs/heads/...)
      let localBranchExists = false
      try {
        oid = await this.repo.resolveRef(`refs/heads/${ref}`)
        localBranchExists = true
      } catch {
        // Local branch doesn't exist, try to resolve as-is (might be a tag, remote branch, etc.)
        oid = await this.repo.resolveRef(ref)
        // Check if it resolved to a remote tracking branch
        try {
          const remoteRef = `refs/remotes/${remote}/${ref}`
          const remoteOid = await this.repo.resolveRef(remoteRef)
          if (remoteOid === oid) {
            // The ref resolved to a remote tracking branch, create local branch and set up tracking
            createdFromRemote = true
            if (track) {
              // Set up remote tracking branch
              const { ConfigAccess } = await import('../utils/configAccess.ts')
              const configAccess = new ConfigAccess(this.repo.fs, gitdir)
              await configAccess.setConfigValue(`branch.${ref}.remote`, remote, 'local')
              await configAccess.setConfigValue(`branch.${ref}.merge`, `refs/heads/${ref}`, 'local')
            }
            // Create a new branch that points at that same commit
            await this.repo.writeRef(`refs/heads/${ref}`, oid)
          }
        } catch {
          // Not a remote tracking branch, continue with normal resolution
        }
      }
      
      // If local branch exists, check if we should set up tracking config
      if (localBranchExists && track) {
        try {
          const remoteRef = `refs/remotes/${remote}/${ref}`
          const remoteOid = await this.repo.resolveRef(remoteRef)
          // Check if tracking config is already set
          const { ConfigAccess } = await import('../utils/configAccess.ts')
          const configAccess = new ConfigAccess(this.repo.fs, gitdir)
          const existingRemote = await configAccess.getConfigValue(`branch.${ref}.remote`)
          const existingMerge = await configAccess.getConfigValue(`branch.${ref}.merge`)
          if (!existingRemote || !existingMerge) {
            // Tracking config not set, set it up
            await configAccess.setConfigValue(`branch.${ref}.remote`, remote, 'local')
            await configAccess.setConfigValue(`branch.${ref}.merge`, `refs/heads/${ref}`, 'local')
          }
        } catch {
          // Remote tracking branch doesn't exist, that's okay
        }
      }
    } catch (err) {
      if (ref === 'HEAD') throw err
      // If `ref` doesn't exist, try to create a new remote tracking branch
      const remoteRef = `${remote}/${ref}`
      try {
        oid = await this.repo.resolveRef(remoteRef)
        createdFromRemote = true
        if (track) {
          // Set up remote tracking branch
          const { ConfigAccess } = await import('../utils/configAccess.ts')
          const configAccess = new ConfigAccess(this.repo.fs, gitdir)
          await configAccess.setConfigValue(`branch.${ref}.remote`, remote, 'local')
          await configAccess.setConfigValue(`branch.${ref}.merge`, `refs/heads/${ref}`, 'local')
        }
        // Create a new branch that points at that same commit
        await this.repo.writeRef(`refs/heads/${ref}`, oid)
      } catch (remoteErr) {
        throw err
      }
    }

    // Get commit to get tree OID
    const { object: commitObject } = await readObject({ fs: this.repo.fs, cache: this.repo.cache, gitdir, oid })
    const commit = parseCommit(commitObject)
    const treeOid = commit.tree

    // Load sparse checkout patterns if enabled
    let finalSparsePatterns = sparsePatterns
    if (!finalSparsePatterns) {
      try {
        const patterns = await SparseCheckoutManager.loadPatterns({ fs: this.repo.fs, gitdir })
        if (patterns.length > 0) {
          finalSparsePatterns = patterns
        }
      } catch {
        // Sparse checkout not enabled
      }
    }

    // Update HEAD in worktree's gitdir (not main repo's HEAD)
    if (!noUpdateHead) {
      // Special case: if ref is 'HEAD', preserve the current HEAD state
      // (either symbolic or detached) since we're already on HEAD
      if (ref === 'HEAD') {
        // Check if HEAD is currently a symbolic ref
        const { readSymbolicRef } = await import('../git/refs/readRef.ts')
        try {
          const symbolicTarget = await readSymbolicRef({ fs: this.repo.fs, gitdir, ref: 'HEAD' })
          if (symbolicTarget) {
            // HEAD is symbolic, preserve it
            // No need to update since we're already on HEAD
          } else {
            // HEAD is detached or doesn't exist, set it to the OID
            await this.repo.writeRef('HEAD', oid)
          }
        } catch {
          // HEAD doesn't exist, set it to the OID
          await this.repo.writeRef('HEAD', oid)
        }
      } else {
        // Check if ref is a tag, branch, or OID
        let isTag = false
        let isBranch = false
        
        if (ref.startsWith('refs/tags/')) {
          isTag = true
        } else if (ref.startsWith('refs/heads/') || ref.startsWith('refs/remotes/')) {
          isBranch = true
        } else if (ref.match(/^[0-9a-f]{40}$/)) {
          // It's an OID, set as detached HEAD
          isTag = false
          isBranch = false
        } else {
          // Try to determine if it's a tag or branch by checking what exists
          try {
            // Check if it's a tag
            await this.repo.resolveRef(`refs/tags/${ref}`)
            isTag = true
          } catch {
            // Not a tag, check if it's a branch
            try {
              await this.repo.resolveRef(`refs/heads/${ref}`)
              isBranch = true
            } catch {
              // Neither tag nor branch exists, but we already resolved it above
              // If we got here, it might be a remote tracking branch or something else
              // Default to treating as branch if it looks like a branch name
              if (!ref.startsWith('refs/')) {
                isBranch = true
              }
            }
          }
        }
        
        if (isTag) {
          // For tags, set HEAD as detached (direct OID)
          await this.repo.writeRef('HEAD', oid)
        } else if (isBranch) {
          // Set HEAD as symbolic ref pointing to the branch
          // Use provided oldOid if available (from checkout command), otherwise read it
          // CRITICAL: We must read oldOid BEFORE any HEAD modifications, so use providedOldOid if available
          // IMPORTANT: If providedOldOid is passed, use it directly - don't try to read HEAD again
          // The checkout command already read oldOid before any modifications
          const oldOidToUse = providedOldOid
          // Pass oldOid to writeSymbolicRefDirect (even if undefined, it will handle it)
          await this.repo.writeSymbolicRefDirect('HEAD', `refs/heads/${ref}`, oldOidToUse)
        } else {
          // For full refs or OIDs, set HEAD as detached (direct OID)
          await this.repo.writeRef('HEAD', oid)
        }
      }
    }

    // Update working directory and index
    if (!noCheckout) {
      // Read the index once to pass to analyzeCheckout
      const gitIndex = await this.repo.readIndexDirect(false, true, gitdir)
      
      if (dryRun) {
        // Just analyze, don't execute
        const operations = await WorkdirManager.analyzeCheckout({
          fs: this.repo.fs,
          dir: this.dir,
          gitdir,
          treeOid,
          filepaths,
          force,
          sparsePatterns: finalSparsePatterns,
          cache: this.repo.cache,
          index: gitIndex,
        })
        const conflicts = operations.filter(op => op[0] === 'conflict').map(op => op[1] as string)
        if (conflicts.length > 0) {
          throw new CheckoutConflictError(conflicts)
        }
      } else {
        await WorkdirManager.checkout({
          fs: this.repo.fs,
          dir: this.dir,
          gitdir,
          treeOid,
          filepaths,
          force,
          sparsePatterns: finalSparsePatterns,
          cache: this.repo.cache,
          onProgress,
        })
      }
    }
  }
}

