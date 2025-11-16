/**
 * @deprecated Use readObject from '../git/objects/readObject.ts' instead
 * This function is kept for backward compatibility and will be removed in a future version.
 */
import { readObject as readObjectNew } from '../git/objects/readObject.ts'
import type { FsClient } from "../models/FileSystem.ts"

export type ReadObjectResult = {
  object: Buffer
  type?: string
  format: 'content' | 'wrapped' | 'deflated'
  source?: string
  oid?: string
}

/**
 * @deprecated Use readObject from '../git/objects/readObject.ts' instead
 */
export async function _readObject({
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
  format?: 'content' | 'wrapped' | 'deflated'
}): Promise<ReadObjectResult> {
  // Delegate to the new implementation
  const result = await readObjectNew({ fs, cache, gitdir, oid, format })
  return {
    object: result.object,
    type: result.type,
    format: result.format as 'content' | 'wrapped' | 'deflated',
    source: result.source,
    oid,
  }
}

