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

    // CRITICAL: Resolve gitdir through Repository to ensure consistency with add()
    // This ensures that add() and commit() use the same gitdir path and cache entry
    let effectiveGitdir = gitdir
    let repo: import('../core-utils/Repository.ts').Repository | undefined
    try {
      const { Repository } = await import('../core-utils/Repository.ts')
      repo = await Repository.open({ fs, dir, cache, autoDetectConfig: true })
      effectiveGitdir = await repo.getGitdir()
      // Use the repository's cache to ensure consistency
      // Repository.open uses the provided cache if given, so repo.cache === cache
    } catch {
      // If Repository.open fails, use provided gitdir
      effectiveGitdir = gitdir
    }

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

