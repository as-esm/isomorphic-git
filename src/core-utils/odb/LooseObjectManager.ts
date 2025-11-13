import { InternalError } from "../../errors/InternalError.ts"
import { toObjectPath } from '../GitPath.ts'
import { deflate, inflate } from '../Zlib.ts'
import { hashObject } from '../ShaHasher.ts'
import { GitObject } from "../../models/GitObject.ts"
import type { FsClient } from "../../models/FileSystem.ts"

type ObjectFormat = 'deflated' | 'wrapped' | 'content'

type ReadResult = {
  object: Buffer
  format: string
  source: string
  type?: string
}

/**
 * Reads a loose object from the object database
 */
export const read = async ({
  fs,
  gitdir,
  oid,
  format = 'deflated',
}: {
  fs: FsClient
  gitdir: string
  oid: string
  format?: ObjectFormat
}): Promise<ReadResult | null> => {
  const source = toObjectPath(oid)
  const filepath = `${gitdir}/${source}`

  try {
    const file = await fs.read(filepath)
    if (!file) {
      return null
    }

    const fileBuffer = Buffer.isBuffer(file) ? file : Buffer.from(file as string | Uint8Array)

    // Loose objects are always stored deflated
    if (format === 'deflated') {
      return { object: fileBuffer, format: 'deflated', source }
    }

    // Inflate the object
    const inflated = await inflate(fileBuffer)

    // Always return wrapped format - let ObjectReader handle unwrapping and SHA verification
    // This ensures SHA checks happen on the wrapped object before unwrapping
    return { object: Buffer.from(inflated), format: 'wrapped', source }
  } catch {
    return null
  }
}

/**
 * Writes a loose object to the object database
 */
export const write = async ({
  fs,
  gitdir,
  type,
  content,
  format = 'content',
  oid,
}: {
  fs: FsClient
  gitdir: string
  type: string
  content: Buffer | Uint8Array
  format?: ObjectFormat
  oid?: string
}): Promise<string> => {
  let wrapped: Buffer
  let computedOid: string

  const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content)

  // Convert to wrapped format
  if (format === 'content') {
    wrapped = GitObject.wrap({ type, object: contentBuffer })
    computedOid = await hashObject({ type, content: contentBuffer })
  } else if (format === 'wrapped') {
    wrapped = contentBuffer
    // Extract type and content from wrapped object to compute OID
    const unwrapped = GitObject.unwrap(wrapped)
    computedOid = await hashObject({ type: unwrapped.type, content: unwrapped.object })
  } else {
    // format === 'deflated'
    if (!oid) {
      throw new InternalError('OID is required when writing deflated objects')
    }
    computedOid = oid
  }

  const finalOid = oid ?? computedOid

  // Deflate the wrapped object
  let deflated: Buffer
  if (format === 'deflated') {
    deflated = contentBuffer
  } else {
    deflated = Buffer.from(await deflate(wrapped))
  }

  // Write to disk
  const source = toObjectPath(finalOid)
  const filepath = `${gitdir}/${source}`

  // Don't overwrite existing git objects - this helps avoid EPERM errors.
  // Although I don't know how we'd fix corrupted objects then. Perhaps delete them
  // on read?
  if (!(await fs.exists(filepath))) {
    await fs.write(filepath, deflated)
  }

  return finalOid
}
