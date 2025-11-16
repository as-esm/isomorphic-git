import { GitObject } from "../../models/GitObject.ts"
import { shasum } from "../../core-utils/ShaHasher.ts"

/**
 * Compute the SHA-1 hash of a git object
 * 
 * @param type - Object type ('blob', 'tree', 'commit', 'tag')
 * @param object - Object content
 * @param format - Format of the input object ('content', 'wrapped', or 'deflated')
 * @param oid - Optional OID (required if format is 'deflated')
 * @returns Promise resolving to the OID and the wrapped object buffer
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
  let resultObject: Buffer
  let resultOid: string | undefined = oid
  if (format !== 'deflated') {
    if (format !== 'wrapped') {
      const objectBuffer = Buffer.isBuffer(object) ? object : Buffer.from(object)
      const wrapped = GitObject.wrap({ type, object: objectBuffer })
      resultObject = Buffer.from(wrapped)
    } else {
      resultObject = Buffer.isBuffer(object) ? object : Buffer.from(object)
    }
    resultOid = await shasum(resultObject)
  } else {
    resultObject = Buffer.isBuffer(object) ? object : Buffer.from(object)
  }
  if (!resultOid) {
    throw new Error('oid is required when format is deflated')
  }
  return { oid: resultOid, object: resultObject }
}

