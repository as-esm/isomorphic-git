import { _merge } from "../commands/merge.ts"
import { MissingNameError } from "../errors/MissingNameError.ts"
import { Repository } from "../core-utils/Repository.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { normalizeAuthorObject } from "../utils/normalizeAuthorObject.ts"
import { normalizeCommitterObject } from "../utils/normalizeCommitterObject.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { SignCallback } from "../core-utils/Signing.ts"
import type { Author } from "../models/GitCommit.ts"

// ============================================================================
// MERGE TYPES
// ============================================================================

/**
 * Merge operation result
 */
export type MergeResult = {
  oid?: string
  alreadyMerged?: boolean
  fastForward?: boolean
  mergeCommit?: boolean
  tree?: string
}

/**
 * Merge two branches
 * @param repo - Repository instance (preferred, will be created if not provided)
 * @param fs - Filesystem client (deprecated, use repo instead)
 * @param dir - Working directory (deprecated, use repo instead)
 * @param gitdir - Git directory (deprecated, use repo instead)
 * @param cache - Cache object (deprecated, use repo instead)
 */
export async function merge({
  repo: _repo,
  fs,
  onSign,
  dir = "",
  gitdir = join(dir, '.git'),
  ours,
  theirs,
  fastForward = true,
  fastForwardOnly = false,
  dryRun = false,
  noUpdateBranch = false,
  abortOnConflict = true,
  message,
  author: _author,
  committer: _committer,
  signingKey,
  cache = {},
  allowUnrelatedHistories = false,
  mergeDriver,
}: {
  repo?: Repository
  fs?: FsClient
  onSign?: SignCallback
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
  cache?: Record<string, unknown>
  allowUnrelatedHistories?: boolean
  mergeDriver?: (params: {
    branches: [string, string, string]
    contents: [string, string, string]
    path: string
  }) => { cleanMerge: boolean; mergedText: string }
}): Promise<MergeResult> {
  try {
    // Create Repository if not provided (backward compatibility)
    let repo: Repository
    if (_repo) {
      repo = _repo
    } else {
      if (!fs) {
        throw new Error('Either repo or fs must be provided')
      }
      // For bare repos, we might only have gitdir, not dir
      if (dir) {
        // Create Repository from working directory
        repo = await Repository.open({ fs, dir, cache, autoDetectConfig: true })
      } else if (gitdir) {
        // For bare repos, create Repository with gitdir as the base
        // Repository.open expects a dir, so we'll use gitdir and let it detect it's bare
        repo = await Repository.open({ fs, dir: gitdir, cache, autoDetectConfig: true })
      } else {
        throw new Error('Either repo, dir, or gitdir must be provided')
      }
    }

    const finalGitdir = await repo.getGitdir()
    const finalFs = repo.fs

    if (signingKey) {
      assertParameter('onSign', onSign)
    }

    const author = await normalizeAuthorObject({ fs: finalFs, gitdir: finalGitdir, author: _author })
    if (!author && (!fastForwardOnly || !fastForward)) {
      throw new MissingNameError('author')
    }

    const committer = await normalizeCommitterObject({
      fs: finalFs,
      gitdir: finalGitdir,
      author,
      committer: _committer,
    })
    if (!committer && (!fastForwardOnly || !fastForward)) {
      throw new MissingNameError('committer')
    }

    // Use Repository.merge which internally calls _merge with repo
    return await repo.merge({
      ours,
      theirs,
      fastForward,
      fastForwardOnly,
      dryRun,
      noUpdateBranch,
      abortOnConflict,
      message,
      author: author || undefined,
      committer: committer || (undefined as unknown as Partial<Author>),
      signingKey,
      onSign,
      allowUnrelatedHistories,
      mergeDriver,
    })
  } catch (err: any) {
    // Preserve error type and code - don't modify the error object
    // Just set caller for debugging, but preserve the original error
    if (err && typeof err === 'object') {
      err.caller = 'git.merge'
    }
    throw err
  }
}

