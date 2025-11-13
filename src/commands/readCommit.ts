import { resolveCommit } from '../utils/resolveCommit.js'
import type { FsClient } from '../models/FileSystem.js'
import type { ReadCommitResult } from '../models/GitCommit.js'

/**
 * @param {object} args
 * @param {import('../types.js').FsClient} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string} args.oid
 *
 * @returns {Promise<ReadCommitResult>} Resolves successfully with a git commit object
 * @see ReadCommitResult
 * @see CommitObject
 *
 */
export async function _readCommit({
  fs,
  cache,
  gitdir,
  oid,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
}): Promise<ReadCommitResult> {
  const { commit, oid: commitOid } = await resolveCommit({
    fs,
    cache,
    gitdir,
    oid,
  })
  const result: ReadCommitResult = {
    oid: commitOid,
    commit: commit.parse(),
    payload: commit.withoutSignature(),
  }
  return result
}

