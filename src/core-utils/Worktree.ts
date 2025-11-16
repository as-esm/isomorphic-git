// RefManager import removed - using Repository.resolveRef/writeRef methods instead
import { WorkdirManager } from './filesystem/WorkdirManager.ts'
import { ObjectReader } from './odb/ObjectReader.ts'
import { parse as parseCommit } from './parsers/Commit.ts'
import { SparseCheckoutManager } from './filesystem/SparseCheckoutManager.ts'
import { CheckoutConflictError } from '../errors/CheckoutConflictError.ts'
import { StagingArea } from './StagingArea.ts'
import type { Repository } from './Repository.ts'
import type { ProgressCallback } from '../managers/GitRemoteHTTP.ts'

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
  private _stagingArea: StagingArea | null = null

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
   */
  getStagingArea(): StagingArea {
    if (!this._stagingArea) {
      this._stagingArea = new StagingArea(this)
    }
    return this._stagingArea
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
    } = options

    // Resolve ref to commit OID using Repository methods
    let oid: string
    try {
      oid = await this.repo.resolveRef(ref)
    } catch (err) {
      if (ref === 'HEAD') throw err
      // If `ref` doesn't exist, try to create a new remote tracking branch
      const remoteRef = `${remote}/${ref}`
      try {
        oid = await this.repo.resolveRef(remoteRef)
        if (track) {
          // Set up remote tracking branch
          const { ConfigAccess } = await import('../utils/configAccess.ts')
          const configAccess = new ConfigAccess(this.repo.fs, gitdir)
          await configAccess.setConfigValue(`branch.${ref}.remote`, remote, 'local')
          await configAccess.setConfigValue(`branch.${ref}.merge`, `refs/heads/${ref}`, 'local')
        }
        // Create a new branch that points at that same commit
        await this.repo.writeRef(`refs/heads/${ref}`, oid)
      } catch {
        throw err
      }
    }

    // Get commit to get tree OID
    const { object: commitObject } = await ObjectReader.read({ fs: this.repo.fs, cache: this.repo.cache, gitdir, oid })
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
        // If ref is a branch name (not a full ref path and not a tag), set HEAD as symbolic ref
        // Otherwise, set HEAD as detached (direct OID)
        const isBranchRef = ref && !ref.startsWith('refs/') && !ref.match(/^[0-9a-f]{40}$/)
        if (isBranchRef) {
          // Set HEAD as symbolic ref pointing to the branch
          await this.repo.writeSymbolicRefDirect('HEAD', `refs/heads/${ref}`)
        } else {
          // For tags, full refs, or OIDs, set HEAD as detached (direct OID)
          await this.repo.writeRef('HEAD', oid)
        }
      }
    }

    // Update working directory and index
    if (!noCheckout) {
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

