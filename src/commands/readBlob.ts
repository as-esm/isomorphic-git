import { resolveBlob } from '../utils/resolveBlob.js'
import { resolveFilepath } from '../utils/resolveFilepath.js'
import type { FsClient } from '../models/FileSystem.js'
import type { ReadBlobResult } from '../api/readBlob.js'

/**
 * @param {object} args
 * @param {import('../types.js').FsClient} args.fs
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

