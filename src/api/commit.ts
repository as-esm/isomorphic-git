import { _commit } from "../commands/commit.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { SignCallback } from "../core-utils/Signing.ts"
import type { Author } from "../models/GitCommit.ts"

/**
 * Create a new commit
 */
export async function commit({
  fs,
  onSign,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  message,
  author,
  committer,
  signingKey,
  amend = false,
  dryRun = false,
  noUpdateBranch = false,
  ref,
  parent,
  tree,
  cache = {},
  autoDetectConfig = true,
}: {
  fs: FsClient
  onSign?: SignCallback
  dir?: string
  gitdir?: string
  message?: string
  author?: Partial<Author>
  committer?: Partial<Author>
  signingKey?: string
  amend?: boolean
  dryRun?: boolean
  noUpdateBranch?: boolean
  ref?: string
  parent?: string[]
  tree?: string
  cache?: Record<string, unknown>
  autoDetectConfig?: boolean
}): Promise<string> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir!)
    if (!amend) {
      assertParameter('message', message)
    }
    if (signingKey) {
      assertParameter('onSign', onSign)
    }

    // CRITICAL: Use Repository to ensure state consistency
    // This ensures that add() and commit() use the same Repository instance and config service
    const { Repository } = await import('../core-utils/Repository.ts')
    const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig })
    const effectiveGitdir = await repo.getGitdir()

    return await _commit({
      fs,
      cache,
      onSign,
      gitdir: effectiveGitdir,
      message,
      author,
      committer,
      signingKey,
      amend,
      dryRun,
      noUpdateBranch,
      ref,
      parent,
      tree,
      repo,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.commit'
    throw err
  }
}

