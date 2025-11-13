import { resolveFilepath } from "../utils/resolveFilepath.ts"
import { resolveTree } from "../utils/resolveTree.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { ReadTreeResult } from "../models/GitTree.ts"

/**
 * @param {object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string} args.oid
 * @param {string} [args.filepath]
 *
 * @returns {Promise<ReadTreeResult>}
 */
export async function _readTree({
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
}): Promise<ReadTreeResult> {
  let resolvedOid = oid
  if (filepath !== undefined) {
    resolvedOid = await resolveFilepath({ fs, cache, gitdir, oid, filepath })
  }
  const { tree, oid: treeOid } = await resolveTree({ fs, cache, gitdir, oid: resolvedOid })
  const result: ReadTreeResult = {
    oid: treeOid,
    tree: tree.entries(),
  }
  return result
}

