/**
 * @deprecated Use hasObject from '../git/objects/hasObject.ts' instead
 * This function is kept for backward compatibility and will be removed in a future version.
 */
import { hasObject as hasObjectNew } from '../git/objects/hasObject.ts'
import type { FsClient } from "../models/FileSystem.ts"

/**
 * @deprecated Use hasObject from '../git/objects/hasObject.ts' instead
 */
export async function hasObject({
  fs,
  cache,
  gitdir,
  oid,
  format = 'content',
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
  format?: string
}): Promise<boolean> {
  // Delegate to the new implementation
  return await hasObjectNew({ fs, cache, gitdir, oid, format })
}

