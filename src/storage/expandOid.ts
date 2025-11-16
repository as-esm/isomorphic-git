/**
 * @deprecated Use expandOid from '../git/objects/expandOid.ts' instead
 * This function is kept for backward compatibility and will be removed in a future version.
 */
import { expandOid as expandOidNew } from '../git/objects/expandOid.ts'
import type { FsClient } from "../models/FileSystem.ts"

/**
 * @deprecated Use expandOid from '../git/objects/expandOid.ts' instead
 */
export async function _expandOid({
  fs,
  cache,
  gitdir,
  oid: short,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
}): Promise<string> {
  // Delegate to the new implementation
  return await expandOidNew({ fs, cache, gitdir, oid: short })
}

