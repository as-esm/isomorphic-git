import Hash from 'sha.js/sha1.js'
import { InternalError } from '../../errors/InternalError.js'
import { deflate } from '../Zlib.js'
import { padHex } from '../../utils/padHex.js'
import type { ProgressCallback } from '../../managers/GitRemoteHTTP.js'

/**
 * Object type encoding for packfiles
 */
const PACK_TYPES: Record<string, number> = {
  commit: 0b0010000,
  tree: 0b0100000,
  blob: 0b0110000,
  tag: 0b1000000,
  ofs_delta: 0b1100000,
  ref_delta: 0b1110000,
}

type PackObject = {
  oid: string
  type: string
  content: Buffer | Uint8Array
}

type WriteResult = {
  packfile: Buffer
  indexfile: Buffer
}

/**
 * Writes a packfile from a set of Git objects
 * Note: This is a basic implementation without delta compression
 */
export const write = async ({
  objects,
  onProgress,
}: {
  objects: PackObject[]
  onProgress?: ProgressCallback
}): Promise<WriteResult> => {
  const hash = new Hash()
  const outputStream: Buffer[] = []

  const write = (chunk: string | Buffer, enc?: string): void => {
    const buff = typeof chunk === 'string' ? Buffer.from(chunk, enc as BufferEncoding) : chunk
    outputStream.push(buff)
    hash.update(buff)
  }

  const writeObject = async ({ type, object }: { type: string; object: Buffer | Uint8Array }): Promise<void> => {
    // Object type is encoded in bits 654
    const packType = PACK_TYPES[type]
    if (packType === undefined) {
      throw new InternalError(`Unknown object type: ${type}`)
    }

    const objectBuffer = Buffer.isBuffer(object) ? object : Buffer.from(object)

    // The length encoding gets complicated.
    let length = objectBuffer.length
    // Whether the next byte is part of the variable-length encoded number
    // is encoded in bit 7
    let multibyte = length > 0b1111 ? 0b10000000 : 0b0
    // Last four bits of length is encoded in bits 3210
    const lastFour = length & 0b1111
    // Discard those bits
    length = length >>> 4
    // The first byte is then (1-bit multibyte?), (3-bit type), (4-bit least sig 4-bits of length)
    let byte = (multibyte | packType | lastFour).toString(16)
    write(byte, 'hex')
    // Now we keep chopping away at length 7-bits at a time until its zero,
    // writing out the bytes in what amounts to little-endian order.
    while (multibyte) {
      multibyte = length > 0b01111111 ? 0b10000000 : 0b0
      byte = multibyte | (length & 0b01111111)
      write(padHex(2, byte), 'hex')
      length = length >>> 7
    }
    // Lastly, we can compress and write the object.
    write(Buffer.from(await deflate(objectBuffer)))
  }

  // Write packfile header
  write('PACK')
  write('00000002', 'hex') // Version 2
  // Write a 4 byte (32-bit) int for number of objects
  write(padHex(8, objects.length), 'hex')

  // Write each object
  for (let i = 0; i < objects.length; i++) {
    const { type, content } = objects[i]
    await writeObject({ type, object: content })

    if (onProgress) {
      await onProgress({
        phase: 'Writing objects',
        loaded: i + 1,
        total: objects.length,
      })
    }
  }

  // Write SHA1 checksum
  const digest = hash.digest()
  outputStream.push(digest)

  const packfile = Buffer.concat(outputStream)
  const packfileSha = packfile.slice(-20).toString('hex')

  // Generate index file (basic implementation)
  // TODO: Implement full index file generation with fanout table, CRCs, etc.
  const indexfile = await generateIndexFile({ objects, packfileSha })

  return { packfile, indexfile }
}

/**
 * Generates a basic index file for the packfile
 * Note: This is a simplified implementation
 */
const generateIndexFile = async ({
  objects,
  packfileSha,
}: {
  objects: PackObject[]
  packfileSha: string
}): Promise<Buffer> => {
  // This is a placeholder - full implementation would require:
  // - Fanout table
  // - Sorted hash list
  // - CRC32 checksums
  // - Offset table
  // - Packfile SHA
  // - Index SHA

  // For now, return a minimal valid index
  // TODO: Implement full index file format
  throw new InternalError('Full index file generation not yet implemented. Use GitPackIndex.fromPack() instead.')
}
