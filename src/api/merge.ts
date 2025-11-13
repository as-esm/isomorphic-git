import { _merge } from '../commands/merge.js'
import { MissingNameError } from '../errors/MissingNameError.js'
import { assertParameter } from '../utils/assertParameter.js'
import { join } from '../utils/join.js'
import { normalizeAuthorObject } from '../utils/normalizeAuthorObject.js'
import { normalizeCommitterObject } from '../utils/normalizeCommitterObject.js'
import type { FsClient } from '../models/FileSystem.js'
import type { SignCallback } from '../core-utils/Signing.js'
import type { Author } from '../models/GitCommit.js'

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
 */
export async function merge({
  fs,
  onSign,
  dir="",
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
}: {
  fs: FsClient
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
}): Promise<MergeResult> {
  try {
    assertParameter('fs', fs)
    if (signingKey) {
      assertParameter('onSign', onSign)
    }

    const author = await normalizeAuthorObject({ fs, gitdir, author: _author })
    if (!author && (!fastForwardOnly || !fastForward)) {
      throw new MissingNameError('author')
    }

    const committer = await normalizeCommitterObject({
      fs,
      gitdir,
      author,
      committer: _committer,
    })
    if (!committer && (!fastForwardOnly || !fastForward)) {
      throw new MissingNameError('committer')
    }

    return await _merge({
      fs,
      cache,
      dir,
      gitdir,
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
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.merge'
    throw err
  }
}

