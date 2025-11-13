// My version of git-list-pack - roughly 15x faster than the original
// It's used slightly differently - instead of returning a through stream it wraps a stream.
// (I tried to make it API identical, but that ended up being 2x slower than this version.)
import pako from 'pako'

import { InternalError } from '../errors/InternalError.ts'
import { StreamReader } from './StreamReader.ts'

type PackData = {
  data: Uint8Array
  type: string
  num: number
  offset: number
  end: number
  reference?: Buffer
  ofs?: number
}

export const listpack = async (
  stream: AsyncIterable<Buffer> | ReadableStream,
  onData: (data: PackData) => Promise<void>
): Promise<void> => {
  const reader = new StreamReader(stream)
  let PACK = await reader.read(4)
  if (!PACK) {
    throw new InternalError('Invalid PACK header: empty stream')
  }
  const packStr = PACK.toString('utf8')
  if (packStr !== 'PACK') {
    throw new InternalError(`Invalid PACK header '${packStr}'`)
  }

  let version = await reader.read(4)
  if (!version) {
    throw new InternalError('Invalid packfile: missing version')
  }
  const versionNum = version.readUInt32BE(0)
  if (versionNum !== 2) {
    throw new InternalError(`Invalid packfile version: ${versionNum}`)
  }

  let numObjects = await reader.read(4)
  if (!numObjects) {
    throw new InternalError('Invalid packfile: missing object count')
  }
  const numObjectsCount = numObjects.readUInt32BE(0)
  // If (for some godforsaken reason) this is an empty packfile, abort now.
  if (numObjectsCount < 1) return

  let remainingObjects = numObjectsCount
  while (!reader.eof() && remainingObjects--) {
    const offset = reader.tell()
    const { type, length, ofs, reference } = await parseHeader(reader)
    const inflator = new pako.Inflate()
    while (!inflator.result) {
      const chunk = await reader.chunk()
      if (!chunk) break
      inflator.push(chunk, false)
      if (inflator.err) {
        throw new InternalError(`Pako error: ${inflator.msg}`)
      }
      if (inflator.result) {
        if (inflator.result.length !== length) {
          throw new InternalError(
            `Inflated object size is different from that stated in packfile.`
          )
        }

        // Backtrack parser to where deflated data ends
        await reader.undo()
        const bytesRead = chunk.length - inflator.strm.avail_in
        await reader.read(bytesRead)
        const end = reader.tell()
        await onData({
          data: inflator.result,
          type,
          num: remainingObjects,
          offset,
          end,
          reference,
          ofs,
        })
      }
    }
  }
}

type HeaderResult = {
  type: string
  length: number
  ofs?: number
  reference?: Buffer
}

const parseHeader = async (reader: StreamReader): Promise<HeaderResult> => {
  // Object type is encoded in bits 654
  const byte = await reader.byte()
  if (byte === undefined) {
    throw new InternalError('Unexpected end of packfile while reading header')
  }
  const type = (byte >> 4) & 0b111
  // The length encoding get complicated.
  // Last four bits of length is encoded in bits 3210
  let length = byte & 0b1111
  // Whether the next byte is part of the variable-length encoded number
  // is encoded in bit 7
  if (byte & 0b10000000) {
    let shift = 4
    let nextByte: number | undefined
    do {
      nextByte = await reader.byte()
      if (nextByte === undefined) {
        throw new InternalError('Unexpected end of packfile while reading length')
      }
      length |= (nextByte & 0b01111111) << shift
      shift += 7
    } while (nextByte & 0b10000000)
  }
  // Handle deltified objects
  let ofs: number | undefined
  let reference: Buffer | undefined
  if (type === 6) {
    let shift = 0
    ofs = 0
    const bytes: number[] = []
    let deltaByte: number | undefined
    do {
      deltaByte = await reader.byte()
      if (deltaByte === undefined) {
        throw new InternalError('Unexpected end of packfile while reading delta offset')
      }
      ofs |= (deltaByte & 0b01111111) << shift
      shift += 7
      bytes.push(deltaByte)
    } while (deltaByte & 0b10000000)
    reference = Buffer.from(bytes)
  }
  if (type === 7) {
    const buf = await reader.read(20)
    if (!buf) {
      throw new InternalError('Unexpected end of packfile while reading ref-delta')
    }
    reference = buf
  }
  const typeMap: Record<number, string> = {
    1: 'commit',
    2: 'tree',
    3: 'blob',
    4: 'tag',
    6: 'ofs-delta',
    7: 'ref-delta',
  }
  return { type: typeMap[type] || String(type), length, ofs, reference }
}

