/**
 * @deprecated Use hashObject from '../git/objects/hashObject.ts' instead
 * This function is kept for backward compatibility and will be removed in a future version.
 */
import { hashObject as hashObjectNew } from '../git/objects/hashObject.ts'

/**
 * @deprecated Use hashObject from '../git/objects/hashObject.ts' instead
 */
export async function hashObject({
  type,
  object,
  format = 'content',
  oid = undefined,
}: {
  type: string
  object: Buffer | Uint8Array
  format?: 'content' | 'wrapped' | 'deflated'
  oid?: string
}): Promise<{ oid: string; object: Buffer }> {
  // Delegate to the new implementation
  return await hashObjectNew({ type, object, format, oid })
}

