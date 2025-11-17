import crc32 from 'crc-32'

import { InternalError } from '../errors/InternalError.ts'
import { GitObject } from "../models/GitObject.ts"
import { BufferCursor } from "../utils/BufferCursor.ts"
import { applyDelta } from "../utils/applyDelta.ts"
import { listpack } from "../utils/git-list-pack.ts"
import { inflate } from "../utils/inflate.ts"
import pako from 'pako'
import { shasum } from "../utils/shasum.ts"
import type { ProgressCallback } from "../git/remote/GitRemoteHTTP.ts"

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
  referenceOid?: string // For ref-deltas, store the OID of the base object
  compressedLength?: number // Length of compressed data for this object
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
  offsetToEnd: Map<number, number> = new Map() // Map from offset to end offset for each object

  constructor(stuff: {
    hashes?: string[]
    crcs?: Record<string, number>
    offsets?: Map<string, number>
    packfileSha?: string
    getExternalRefDelta?: (oid: string) => Promise<{ type: string; object: Buffer }>
    pack?: Promise<Buffer | Uint8Array>
    offsetToEnd?: Map<number, number>
  }) {
    Object.assign(this, stuff)
    this.offsetCache = {} as Record<number, { type: string; object: Buffer; format: 'content' }>
    this.readDepth = 0
    this.externalReadDepth = 0
    this.offsetToEnd = stuff.offsetToEnd || new Map()
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
    console.log(`[Packfile Index] Starting listpack on packfile of size ${packBuf.byteLength} bytes`)
    try {
      await listpack(packBufIterable(), async ({ data, type, reference, offset, num, end }) => {
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
        // listpack already returns type as a string ('commit', 'tree', 'blob', 'tag', 'ofs-delta', 'ref-delta')
        // No need to map it again
        const typeStr = type

        if (['commit', 'tree', 'blob', 'tag'].includes(typeStr)) {
          offsetToObject[offset] = {
            type: typeStr,
            offset,
            end, // Store the end offset from listpack
          }
        } else if (typeStr === 'ofs-delta') {
          offsetToObject[offset] = {
            type: typeStr,
            offset,
            end, // Store the end offset from listpack
          }
        } else if (typeStr === 'ref-delta') {
          // Store the reference OID for ref-deltas so we can use it later
          const referenceOid = reference ? reference.toString('hex') : undefined
          offsetToObject[offset] = {
            type: typeStr,
            offset,
            end, // Store the end offset from listpack
            referenceOid,
          }
        } else {
          console.warn(`[Packfile Index] Unknown object type: ${typeStr} at offset ${offset}`)
        }
      })
    } catch (err: any) {
      // Handle truncated or invalid packfiles gracefully
      // If listpack fails (e.g., pack is truncated), return an index with no objects
      if (err instanceof InternalError || err?.code === 'InternalError') {
        console.warn(`[Packfile Index] listpack failed (likely truncated packfile): ${err.message}`)
        // Continue with empty offsetToObject - will return index with 0 offsets
      } else {
        // Re-throw unexpected errors
        throw err
      }
    }
    console.log(`[Packfile Index] listpack completed. Found ${Object.keys(offsetToObject).length} objects in packfile. Total object count: ${totalObjectCount}`)

    // We need to know the lengths of the slices to compute the CRCs.
    const offsetArray = Object.keys(offsetToObject).map(Number).sort((a, b) => a - b)
    console.log(`[Packfile Index] Computing CRCs for ${offsetArray.length} objects`)
    for (const [i, start] of offsetArray.entries()) {
      // Use the end from listpack if available, otherwise calculate it
      const o = offsetToObject[start]
      const end = o.end || (i + 1 === offsetArray.length ? packBuf.byteLength - 20 : offsetArray[i + 1])
      o.end = end // Ensure end is set
      const crc = crc32.buf(packBuf.slice(start, end)) >>> 0
      o.crc = crc
    }
    console.log(`[Packfile Index] CRC computation completed. Starting delta resolution.`)

    // Store offset -> end mapping for readSlice to use
    const offsetToEndMap = new Map<number, number>()
    for (const [start, o] of Object.entries(offsetToObject)) {
      if (o.end) {
        offsetToEndMap.set(Number(start), o.end)
      }
    }
    
    // We don't have the hashes yet. But we can generate them using the .readSlice function!
    // Create a getExternalRefDelta that can use the index being built
    const p = new GitPackIndex({
      offsetToEnd: offsetToEndMap, // Use the populated map
      pack: Promise.resolve(packBuf),
      packfileSha,
      crcs,
      hashes,
      offsets,
      getExternalRefDelta: getExternalRefDelta
        ? async (oid: string) => {
            // First, try to read from the packfile being indexed (using the index being built)
            // Check if this OID is already resolved and in the offsets map
            // This allows ref-deltas to reference objects in the same packfile
            if (offsets.has(oid)) {
              try {
                // Use readSlice directly with the offset to avoid recursive calls
                const offset = offsets.get(oid)!
                const result = await p.readSlice({ start: offset })
                return { type: result.type, object: result.object }
              } catch (err) {
                // If readSlice fails, it might be because the object itself is a delta
                // that can't be resolved yet. Fall through to try finding it by scanning
                console.warn(`[Packfile Index] Failed to read resolved object ${oid} at offset ${offsets.get(oid)}:`, err)
              }
            }
            
            // Check if the object is in the packfile but not yet resolved
            // We can check by looking for it in offsetToObject by scanning for matching referenceOid
            // But actually, we can't know the OID until we resolve the object, so this doesn't help
            // The multi-pass will handle this by retrying in the next pass
            
            // Object is not in the packfile being indexed (or not resolved yet)
            // Fall back to the original getExternalRefDelta to try reading from disk
            // If that fails, the error will be caught in the multi-pass loop and retried
            if (getExternalRefDelta) {
              try {
                return await getExternalRefDelta(oid)
              } catch (err) {
                // Object not found externally - might be in packfile but not resolved yet
                // This will cause the object to be skipped in this pass and retried in the next
                console.warn(`[Packfile Index] Could not find ref-delta base object ${oid} externally, will retry in next pass`)
                throw err
              }
            }
            // No getExternalRefDelta provided - this object can't be resolved
            // This will cause the object to be skipped in this pass and retried in the next
            throw new Error(`Could not resolve ref-delta base object ${oid}`)
          }
        : undefined,
    })

    // Resolve deltas and compute the oids
    // Use multiple passes to handle ref-deltas that depend on objects later in the packfile
    // First pass: resolve all base objects (non-deltas) and ofs-deltas
    // Subsequent passes: resolve ref-deltas
    lastPercent = null
    let count = 0
    const objectsByDepth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    let maxPasses = 10 // Maximum number of passes to resolve all deltas
    let pass = 0
    
    while (pass < maxPasses) {
      let resolvedThisPass = 0
      count = 0
      lastPercent = null
      
      for (let offsetStr in offsetToObject) {
        const offset = Number(offsetStr)
        const o = offsetToObject[offset]
        if (o.oid) continue // Already resolved
        
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
          resolvedThisPass++
        } catch (err: any) {
          // Object couldn't be resolved in this pass, will retry in next pass
          // Log the error for debugging
          let errorMsg = 'Unknown error'
          if (err) {
            if (err instanceof Error) {
              errorMsg = err.message || err.toString()
            } else if (typeof err === 'string') {
              errorMsg = err
            } else {
              errorMsg = String(err)
            }
          }
          if (pass === maxPasses - 1) {
            console.warn(`[Packfile Index] Could not resolve object at offset ${offset} (type: ${o.type}, referenceOid: ${o.referenceOid || 'none'}) after ${maxPasses} passes:`, errorMsg)
            if (err instanceof Error && err.stack) {
              console.warn(`[Packfile Index] Error stack:`, err.stack)
            }
          } else {
            // Only log first few errors to avoid spam
            if (count <= 5) {
              console.log(`[Packfile Index] Pass ${pass + 1}: Could not resolve object at offset ${offset} (type: ${o.type}, referenceOid: ${o.referenceOid || 'none'}), will retry. Error:`, errorMsg, err)
            }
          }
        }
      }
      
      // If we didn't resolve any new objects in this pass, we're done
      if (resolvedThisPass === 0) {
        // Check if there are any unresolved objects
        const unresolvedCount = Object.values(offsetToObject).filter(o => !o.oid).length
        if (unresolvedCount > 0) {
          const unresolved = Object.entries(offsetToObject)
            .filter(([_, o]) => !o.oid)
            .map(([offset, o]) => `offset ${offset} (type: ${o.type}, referenceOid: ${o.referenceOid || 'none'})`)
            .slice(0, 10) // Show first 10
          console.warn(`[Packfile Index] ${unresolvedCount} objects could not be resolved after ${pass + 1} passes. First few:`, unresolved)
        }
        break
      }
      
      console.log(`[Packfile Index] Pass ${pass + 1}: Resolved ${resolvedThisPass} objects. Total resolved: ${Object.values(offsetToObject).filter(o => o.oid).length}/${totalObjectCount}`)
      pass++
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
    // Check if the OID is in the offsets map
    const start = this.offsets.get(oid)
    if (start !== undefined) {
      return this.readSlice({ start })
    }
    // If not found, try getExternalRefDelta (for ref-deltas that reference objects outside this packfile)
    if (this.getExternalRefDelta) {
      this.externalReadDepth++
      const result = await this.getExternalRefDelta(oid)
      return { ...result, format: 'content' as const }
    } else {
      throw new InternalError(`Could not read object ${oid} from packfile`)
    }
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
    // Use the end offset stored in offsetToEnd to know exactly where the compressed data ends
    const compressedStartRelative = reader.tell() // Position relative to start of raw
    const compressedStartAbsolute = start + compressedStartRelative // Absolute position in packBuffer
    const endOffset = this.offsetToEnd.get(start)
    
    if (endOffset) {
      // We know exactly where the compressed data ends
      // compressedStartAbsolute is the absolute position after the header (and delta info if any)
      // endOffset is the absolute end position of the compressed data
      const compressedData = packBuffer.slice(compressedStartAbsolute, endOffset)
      object = Buffer.from(await inflate(compressedData))
    } else {
      // Fallback: use streaming inflate like listpack does
      const inflator = new pako.Inflate()
      let compressedEnd = compressedStartAbsolute
      
      // Read chunks until inflator is done
      while (!inflator.result) {
        const remaining = packBuffer.length - compressedEnd
        if (remaining <= 0) break
        const chunkSize = Math.min(1024, remaining)
        const chunk = packBuffer.slice(compressedEnd, compressedEnd + chunkSize)
        inflator.push(chunk, false)
        if (inflator.err) {
          throw new InternalError(`Pako error during readSlice: ${inflator.msg}`)
        }
        if (inflator.result) {
          compressedEnd += chunkSize - (inflator.strm?.avail_in || 0)
          break
        }
        compressedEnd += chunkSize
      }
      
      if (!inflator.result) {
        throw new InternalError('Could not inflate object in readSlice')
      }
      
      object = Buffer.from(inflator.result)
    }
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

