import { resolveBlob } from "../utils/resolveBlob.ts"
import { resolveFilepath } from "../utils/resolveFilepath.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { ReadBlobResult } from '../api/readBlob.ts'

/**
 * @param {object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string} args.oid
 * @param {string} [args.filepath]
 *
 * @returns {Promise<ReadBlobResult>} Resolves successfully with a blob object description
 * @see ReadBlobResult
 */
export async function _readBlob({
  fs,
  cache,
  gitdir,
  oid,
  filepath = undefined,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
  filepath?: string
}): Promise<ReadBlobResult> {
  let resolvedOid = oid
  if (filepath !== undefined) {
    resolvedOid = await resolveFilepath({ fs, cache, gitdir, oid, filepath })
  }
  const blob = await resolveBlob({
    fs,
    cache,
    gitdir,
    oid: resolvedOid,
  })
  return blob
}

