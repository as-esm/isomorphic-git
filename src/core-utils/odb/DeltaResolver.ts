import { InternalError } from '../../errors/InternalError.js'
import { BufferCursor } from '../../utils/BufferCursor.js'

/**
 * Applies a delta patch to a base object to reconstruct the target object
 * Supports both OFS_DELTA and REF_DELTA formats
 */
export const applyDelta = ({
  base,
  delta,
}: {
  base: Buffer | Uint8Array
  delta: Buffer | Uint8Array
}): Buffer => {
  const baseBuffer = Buffer.from(base)
  const deltaBuffer = Buffer.from(delta)

  const reader = new BufferCursor(deltaBuffer)
  const sourceSize = readVarIntLE(reader)

  if (sourceSize !== baseBuffer.byteLength) {
    throw new InternalError(
      `applyDelta expected source buffer to be ${sourceSize} bytes but the provided buffer was ${baseBuffer.length} bytes`
    )
  }
  const targetSize = readVarIntLE(reader)
  let target: Buffer

  const firstOp = readOp(reader, baseBuffer)
  // Speed optimization - return raw buffer if it's just single simple copy
  if (firstOp.byteLength === targetSize) {
    target = firstOp
  } else {
    // Otherwise, allocate a fresh buffer and slices
    target = Buffer.alloc(targetSize)
    const writer = new BufferCursor(target)
    writer.copy(firstOp)

    while (!reader.eof()) {
      writer.copy(readOp(reader, baseBuffer))
    }

    const tell = writer.tell()
    if (targetSize !== tell) {
      throw new InternalError(
        `applyDelta expected target buffer to be ${targetSize} bytes but the resulting buffer was ${tell} bytes`
      )
    }
  }
  return target
}

const readVarIntLE = (reader: BufferCursor): number => {
  let result = 0
  let shift = 0
  let byte: number | null = null
  do {
    byte = reader.readUInt8()
    result |= (byte & 0b01111111) << shift
    shift += 7
  } while (byte & 0b10000000)
  return result
}

const readCompactLE = (reader: BufferCursor, flags: number, size: number): number => {
  let result = 0
  let shift = 0
  while (size--) {
    if (flags & 0b00000001) {
      result |= reader.readUInt8() << shift
    }
    flags >>= 1
    shift += 8
  }
  return result
}

const readOp = (reader: BufferCursor, source: Buffer): Buffer => {
  const byte = reader.readUInt8()
  const COPY = 0b10000000
  const OFFS = 0b00001111
  const SIZE = 0b01110000
  if (byte & COPY) {
    // copy consists of 4 byte offset, 3 byte size (in LE order)
    const offset = readCompactLE(reader, byte & OFFS, 4)
    let size = readCompactLE(reader, (byte & SIZE) >> 4, 3)
    // Yup. They really did this optimization.
    if (size === 0) size = 0x10000
    return source.slice(offset, offset + size)
  } else {
    // insert
    return reader.slice(byte)
  }
}

