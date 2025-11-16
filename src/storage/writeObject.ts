/**
 * @deprecated Use writeObject from '../git/objects/writeObject.ts' instead
 * This function is kept for backward compatibility and will be removed in a future version.
 */
import { writeObject as writeObjectNew } from '../git/objects/writeObject.ts'
import type { FsClient } from "../models/FileSystem.ts"

/**
 * @deprecated Use writeObject from '../git/objects/writeObject.ts' instead
 */
export async function _writeObject({
  fs,
  gitdir,
  type,
  object,
  format = 'content',
  oid = undefined,
  dryRun = false,
}: {
  fs: FsClient
  gitdir: string
  type: string
  object: Buffer | Uint8Array
  format?: 'content' | 'wrapped' | 'deflated'
  oid?: string
  dryRun?: boolean
}): Promise<string> {
  // Delegate to the new implementation
  return await writeObjectNew({ fs, gitdir, type, object, format, oid, dryRun })
}

