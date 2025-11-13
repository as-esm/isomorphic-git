import { GitObject } from "../models/GitObject.ts"
import { writeObjectLoose } from './writeObjectLoose.ts'
import { deflate } from "../utils/deflate.ts"
import { shasum } from "../utils/shasum.ts"
import type { FsClient } from "../models/FileSystem.ts"

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
    resultObject = Buffer.from(await deflate(resultObject))
  } else {
    resultObject = Buffer.isBuffer(object) ? object : Buffer.from(object)
    if (!resultOid) {
      throw new Error('oid is required when format is deflated')
    }
  }
  if (!dryRun) {
    await writeObjectLoose({ fs, gitdir, object: resultObject, format: 'deflated', oid: resultOid })
  }
  return resultOid
}

