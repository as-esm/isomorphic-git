import { GitObject } from "../../models/GitObject.ts"
import { write as writeLoose } from './loose.ts'
import { deflate } from '../../core-utils/Zlib.ts'
import { shasum } from '../../core-utils/ShaHasher.ts'
import type { FsClient } from "../../models/FileSystem.ts"

export type ObjectFormat = 'deflated' | 'wrapped' | 'content'

/**
 * High-level facade for writing objects to the object database
 * Currently only supports writing to loose objects (packfiles are read-only in this implementation)
 * 
 * @param fs - File system client
 * @param gitdir - Path to .git directory
 * @param type - Object type ('blob', 'tree', 'commit', 'tag')
 * @param object - Object content
 * @param format - Format of the input object ('deflated', 'wrapped', or 'content')
 * @param oid - Optional OID (required if format is 'deflated')
 * @param dryRun - If true, don't actually write to disk
 * @returns Promise resolving to the OID of the written object
 */
export async function writeObject({
  fs,
  gitdir,
  type,
  object,
  format = 'content',
  oid,
  dryRun = false,
}: {
  fs: FsClient
  gitdir: string
  type: string
  object: Buffer | Uint8Array
  format?: ObjectFormat
  oid?: string
  dryRun?: boolean
}): Promise<string> {
  let wrapped: Buffer
  let computedOid: string

  if (format !== 'deflated') {
    if (format !== 'wrapped') {
      wrapped = GitObject.wrap({ type, object })
    } else {
      wrapped = Buffer.from(object)
    }
    computedOid = await shasum(wrapped)
    object = Buffer.from(await deflate(wrapped))
  } else {
    computedOid = oid ?? ''
  }

  const finalOid = oid ?? computedOid

  if (!dryRun) {
    await writeLoose({ fs, gitdir, type, content: object, format: 'deflated', oid: finalOid })
  }

  return finalOid
}

