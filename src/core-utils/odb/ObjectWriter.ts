/**
 * @deprecated Use writeObject from '../../git/objects/writeObject.ts' instead
 * This file is kept for backward compatibility and will be removed in a future version.
 * 
 * The new implementation provides the same functionality with better integration
 * into the unified object database structure.
 */
import { GitObject } from "../../models/GitObject.ts"
import { write as writeLoose } from './LooseObjectManager.ts'
import { deflate } from '../Zlib.ts'
import { shasum } from '../ShaHasher.ts'
import type { FsClient } from "../../models/FileSystem.ts"

type ObjectFormat = 'deflated' | 'wrapped' | 'content'

/**
 * High-level facade for writing objects to the object database
 * Currently only supports writing to loose objects (packfiles are read-only in this implementation)
 */
export const write = async ({
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
}): Promise<string> => {
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

/**
 * Namespace export for ObjectWriter
 */
export const ObjectWriter = {
  write,
}