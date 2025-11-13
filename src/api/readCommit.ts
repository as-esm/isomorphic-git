import { _readCommit } from "../commands/readCommit.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { ReadCommitResult } from "../models/GitCommit.ts"

/**
 * Read a commit object directly
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.oid - The SHA-1 object id to get. Annotated tags are peeled.
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<ReadCommitResult>} Resolves successfully with a git commit object
 * @see ReadCommitResult
 * @see CommitObject
 *
 * @example
 * // Read a commit object
 * let sha = await git.resolveRef({ fs, dir: '/tutorial', ref: 'main' })
 * console.log(sha)
 * let commit = await git.readCommit({ fs, dir: '/tutorial', oid: sha })
 * console.log(commit)
 *
 */
export async function readCommit({
  fs,
  dir,
  gitdir = join(dir, '.git'),
  oid,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  oid: string
  cache?: Record<string, unknown>
}): Promise<ReadCommitResult> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir)
    assertParameter('oid', oid)

    return await _readCommit({
      fs: normalizeFs(fs),
      cache,
      gitdir,
      oid,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.readCommit'
    throw err
  }
}

