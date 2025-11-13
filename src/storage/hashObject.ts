import { GitObject } from "../models/GitObject.ts"
import { shasum } from "../utils/shasum.ts"

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

