import crc32 from 'crc-32'

import { InternalError } from '../errors/InternalError.ts'
import { GitObject } from "../models/GitObject.ts"
import { BufferCursor } from "../utils/BufferCursor.ts"
import { applyDelta } from "../utils/applyDelta.ts"
import { listpack } from "../utils/git-list-pack.ts"
import { inflate } from "../utils/inflate.ts"
import { shasum } from "../utils/shasum.ts"
import type { ProgressCallback } from "../managers/GitRemoteHTTP.ts"

function decodeVarInt(reader: BufferCursor): number {
  const bytes: number[] = []
  let byte = 0
  let multibyte = 0
  do {
    byte = reader.readUInt8()
    // We keep bits 6543210
    const lastSeven = byte & 0b01111111
    bytes.push(lastSeven)
    // Whether the next byte is part of the variable-length encoded number
    // is encoded in bit 7
    multibyte = byte & 0b10000000
  } while (multibyte)
  // Now that all the bytes are in big-endian order,
  // alternate shifting the bits left by 7 and OR-ing the next byte.
  // And... do a weird increment-by-one thing that I don't quite understand.
  return bytes.reduce((a, b) => ((a + 1) << 7) | b, -1)
}

// I'm pretty much copying this one from the git C source code,
// because it makes no sense.
function otherVarIntDecode(reader: BufferCursor, startWith: number): number {
  let result = startWith
  let shift = 4
  let byte: number | null = null
  do {
    byte = reader.readUInt8()
    result |= (byte & 0b01111111) << shift
    shift += 7
  } while (byte & 0b10000000)
  return result
}

type OffsetToObjectEntry = {
  type: string
  offset: number
  end?: number
  crc?: number
  oid?: string
}

export class GitPackIndex {
  hashes: string[]
  crcs: Record<string, number>
  offsets: Map<string, number>
  packfileSha: string
  getExternalRefDelta?: (oid: string) => Promise<{ type: string; object: Buffer }>
  pack?: Promise<Buffer | Uint8Array>
  offsetCache: Record<number, { type: string; object: Buffer; format: 'content' }>
  readDepth: number = 0
  externalReadDepth: number = 0

  constructor(stuff: {
    hashes?: string[]
    crcs?: Record<string, number>
    offsets?: Map<string, number>
    packfileSha?: string
    getExternalRefDelta?: (oid: string) => Promise<{ type: string; object: Buffer }>
    pack?: Promise<Buffer | Uint8Array>
  }) {
    Object.assign(this, stuff)
    this.offsetCache = {} as Record<number, { type: string; object: Buffer; format: 'content' }>
    this.readDepth = 0
    this.externalReadDepth = 0
  }

  static async fromIdx({
    idx,
    getExternalRefDelta,
  }: {
    idx: Buffer | Uint8Array
    getExternalRefDelta?: (oid: string) => Promise<{ type: string; object: Buffer }>
  }): Promise<GitPackIndex | undefined> {
    const buf = Buffer.isBuffer(idx) ? idx : Buffer.from(idx)
    const reader = new BufferCursor(buf)
    const magic = reader.slice(4).toString('hex')
    // Check for IDX v2 magic number
    if (magic !== 'ff744f63') {
      return undefined
    }
    const version = reader.readUInt32BE()
    if (version !== 2) {
      throw new InternalError(
        `Unable to read version ${version} packfile IDX. (Only version 2 supported)`
      )
    }
    if (buf.byteLength > 2048 * 1024 * 1024) {
      throw new InternalError(
        `To keep implementation simple, I haven't implemented the layer 5 feature needed to support packfiles > 2GB in size.`
      )
    }
    // Skip over fanout table
    reader.seek(reader.tell() + 4 * 255)
    // Get hashes
    const size = reader.readUInt32BE()
    const hashes: string[] = []
    for (let i = 0; i < size; i++) {
      const hash = reader.slice(20).toString('hex')
      hashes[i] = hash
    }
    reader.seek(reader.tell() + 4 * size)
    // Skip over CRCs
    // Get offsets
    const offsets = new Map<string, number>()
    for (let i = 0; i < size; i++) {
      offsets.set(hashes[i], reader.readUInt32BE())
    }
    const packfileSha = reader.slice(20).toString('hex')
    return new GitPackIndex({
      hashes,
      crcs: {},
      offsets,
      packfileSha,
      getExternalRefDelta,
    })
  }

  static async fromPack({
    pack,
    getExternalRefDelta,
    onProgress,
  }: {
    pack: Buffer | Uint8Array
    getExternalRefDelta?: (oid: string) => Promise<{ type: string; object: Buffer }>
    onProgress?: ProgressCallback
  }): Promise<GitPackIndex> {
    const listpackTypes: Record<number, string> = {
      1: 'commit',
      2: 'tree',
      3: 'blob',
      4: 'tag',
      6: 'ofs-delta',
      7: 'ref-delta',
    }
    const offsetToObject: Record<number, OffsetToObjectEntry> = {}

    const packBuf = Buffer.isBuffer(pack) ? pack : Buffer.from(pack)
    // Older packfiles do NOT use the shasum of the pack itself,
    // so it is recommended to just use whatever bytes are in the trailer.
    // Source: https://github.com/git/git/commit/1190a1acf800acdcfd7569f87ac1560e2d077414
    const packfileSha = packBuf.slice(-20).toString('hex')

    const hashes: string[] = []
    const crcs: Record<string, number> = {}
    const offsets = new Map<string, number>()
    let totalObjectCount: number | null = null
    let lastPercent: number | null = null

    async function* packBufIterable() {
      yield packBuf
    }
    await listpack(packBufIterable(), async ({ data, type, reference, offset, num }) => {
      if (totalObjectCount === null) totalObjectCount = num
      const percent = Math.floor(
        ((totalObjectCount - num) * 100) / totalObjectCount
      )
      if (percent !== lastPercent) {
        if (onProgress) {
          await onProgress({
            phase: 'Receiving objects',
            loaded: totalObjectCount - num,
            total: totalObjectCount,
          })
        }
      }
      lastPercent = percent
      // Change type from a number to a meaningful string
      const typeStr = listpackTypes[type] || 'unknown'

      if (['commit', 'tree', 'blob', 'tag'].includes(typeStr)) {
        offsetToObject[offset] = {
          type: typeStr,
          offset,
        }
      } else if (typeStr === 'ofs-delta') {
        offsetToObject[offset] = {
          type: typeStr,
          offset,
        }
      } else if (typeStr === 'ref-delta') {
        offsetToObject[offset] = {
          type: typeStr,
          offset,
        }
      }
    })

    // We need to know the lengths of the slices to compute the CRCs.
    const offsetArray = Object.keys(offsetToObject).map(Number)
    for (const [i, start] of offsetArray.entries()) {
      const end =
        i + 1 === offsetArray.length ? packBuf.byteLength - 20 : offsetArray[i + 1]
      const o = offsetToObject[start]
      const crc = crc32.buf(packBuf.slice(start, end)) >>> 0
      o.end = end
      o.crc = crc
    }

    // We don't have the hashes yet. But we can generate them using the .readSlice function!
    const p = new GitPackIndex({
      pack: Promise.resolve(packBuf),
      packfileSha,
      crcs,
      hashes,
      offsets,
      getExternalRefDelta,
    })

    // Resolve deltas and compute the oids
    lastPercent = null
    let count = 0
    const objectsByDepth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    for (let offsetStr in offsetToObject) {
      const offset = Number(offsetStr)
      const percent = Math.floor((count * 100) / totalObjectCount!)
      if (percent !== lastPercent) {
        if (onProgress) {
          await onProgress({
            phase: 'Resolving deltas',
            loaded: count,
            total: totalObjectCount!,
          })
        }
      }
      count++
      lastPercent = percent

      const o = offsetToObject[offset]
      if (o.oid) continue
      try {
        p.readDepth = 0
        p.externalReadDepth = 0
        const { type, object } = await p.readSlice({ start: offset })
        objectsByDepth[p.readDepth] += 1
        const oid = await shasum(GitObject.wrap({ type, object }))
        o.oid = oid
        hashes.push(oid)
        offsets.set(oid, offset)
        crcs[oid] = o.crc!
      } catch (err) {
        continue
      }
    }

    hashes.sort()
    return p
  }

  async toBuffer(): Promise<Buffer> {
    const buffers: Buffer[] = []
    const write = (str: string, encoding: 'hex' | 'utf8') => {
      buffers.push(Buffer.from(str, encoding))
    }
    // Write out IDX v2 magic number
    write('ff744f63', 'hex')
    // Write out version number 2
    write('00000002', 'hex')
    // Write fanout table
    const fanoutBuffer = Buffer.alloc(256 * 4)
    const fanoutCursor = new BufferCursor(fanoutBuffer)
    for (let i = 0; i < 256; i++) {
      let count = 0
      for (const hash of this.hashes) {
        if (parseInt(hash.slice(0, 2), 16) <= i) count++
      }
      fanoutCursor.writeUInt32BE(count)
    }
    buffers.push(fanoutBuffer)
    // Write out hashes
    for (const hash of this.hashes) {
      write(hash, 'hex')
    }
    // Write out crcs
    const crcsBuffer = Buffer.alloc(this.hashes.length * 4)
    const crcsCursor = new BufferCursor(crcsBuffer)
    for (const hash of this.hashes) {
      crcsCursor.writeUInt32BE(this.crcs[hash] || 0)
    }
    buffers.push(crcsBuffer)
    // Write out offsets
    const offsetsBuffer = Buffer.alloc(this.hashes.length * 4)
    const offsetsCursor = new BufferCursor(offsetsBuffer)
    for (const hash of this.hashes) {
      const offset = this.offsets.get(hash)
      if (offset !== undefined) {
        offsetsCursor.writeUInt32BE(offset)
      }
    }
    buffers.push(offsetsBuffer)
    // Write out packfile checksum
    write(this.packfileSha, 'hex')
    // Write out shasum
    const totalBuffer = Buffer.concat(buffers)
    const sha = await shasum(totalBuffer)
    const shaBuffer = Buffer.alloc(20)
    shaBuffer.write(sha, 'hex')
    return Buffer.concat([totalBuffer, shaBuffer])
  }

  async load({ pack }: { pack: Promise<Buffer | Uint8Array> }): Promise<void> {
    this.pack = pack
  }

  async unload(): Promise<void> {
    this.pack = undefined
  }

  async read({
    oid,
  }: {
    oid: string
  }): Promise<{ type: string; format: 'content'; object: Buffer }> {
    if (!this.offsets.get(oid)) {
      if (this.getExternalRefDelta) {
        this.externalReadDepth++
        const result = await this.getExternalRefDelta(oid)
        return { ...result, format: 'content' as const }
      } else {
        throw new InternalError(`Could not read object ${oid} from packfile`)
      }
    }
    const start = this.offsets.get(oid)
    if (start === undefined) {
      throw new InternalError(`Could not find offset for ${oid}`)
    }
    return this.readSlice({ start })
  }

  async readSlice({
    start,
  }: {
    start: number
  }): Promise<{ type: string; format: 'content'; object: Buffer }> {
    if (this.offsetCache[start]) {
      return Object.assign({}, this.offsetCache[start], { format: 'content' as const })
    }
    this.readDepth++
    const types: Record<number, string> = {
      0b0010000: 'commit',
      0b0100000: 'tree',
      0b0110000: 'blob',
      0b1000000: 'tag',
      0b1100000: 'ofs_delta',
      0b1110000: 'ref_delta',
    }
    if (!this.pack) {
      throw new InternalError(
        'Tried to read from a GitPackIndex with no packfile loaded into memory'
      )
    }
    const packBuf = await this.pack
    const packBuffer = Buffer.isBuffer(packBuf) ? packBuf : Buffer.from(packBuf)
    const raw = packBuffer.slice(start)
    const reader = new BufferCursor(raw)
    const byte = reader.readUInt8()
    // Object type is encoded in bits 654
    const btype = byte & 0b1110000
    let type = types[btype]
    if (type === undefined) {
      throw new InternalError('Unrecognized type: 0b' + btype.toString(2))
    }
    // The length encoding get complicated.
    // Last four bits of length is encoded in bits 3210
    const lastFour = byte & 0b1111
    let length = lastFour
    // Whether the next byte is part of the variable-length encoded number
    // is encoded in bit 7
    const multibyte = byte & 0b10000000
    if (multibyte) {
      length = otherVarIntDecode(reader, lastFour)
    }
    let base: Buffer | null = null
    let object: Buffer
    // Handle deltified objects
    if (type === 'ofs_delta') {
      const offset = decodeVarInt(reader)
      const baseOffset = start - offset
      const result = await this.readSlice({ start: baseOffset })
      base = result.object
      type = result.type
    }
    if (type === 'ref_delta') {
      const oid = reader.slice(20).toString('hex')
      const result = await this.read({ oid })
      base = result.object
      type = result.type
    }
    // Handle undeltified objects
    const buffer = raw.slice(reader.tell())
    object = Buffer.from(await inflate(buffer))
    // Assert that the object length is as expected.
    if (object.byteLength !== length) {
      throw new InternalError(
        `Packfile told us object would have length ${length} but it had length ${object.byteLength}`
      )
    }
    if (base) {
      object = Buffer.from(applyDelta(object, base))
    }
    // Cache the result based on depth.
    if (this.readDepth > 3) {
      // hand tuned for speed / memory usage tradeoff
      this.offsetCache[start] = { type, object, format: 'content' as const }
    }
    return { type, format: 'content', object }
  }
}

