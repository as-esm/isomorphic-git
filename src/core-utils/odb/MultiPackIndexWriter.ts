import { InternalError } from "../../errors/InternalError.ts"
import { BufferCursor } from "../../utils/BufferCursor.ts"
import { shasum } from "../../utils/shasum.ts"
import { join } from '../GitPath.ts'
import { GitPackIndex } from "../../models/GitPackIndex.ts"
import type { FsClient } from "../../models/FileSystem.ts"
import type { ProgressCallback } from "../../managers/GitRemoteHTTP.ts"

// MIDX chunk IDs
const CHUNK_ID_PACKNAMES = 0x504e414d // 'PNAM'
const CHUNK_ID_OIDFANOUT = 0x4f494446 // 'OIDF'
const CHUNK_ID_OIDLOOKUP = 0x4f49444c // 'OIDL'
const CHUNK_ID_OBJOFFSETS = 0x4f4f4646 // 'OOFF'
const CHUNK_ID_LARGE_OFFSETS = 0x4c4f4646 // 'LOFF'
const CHUNK_ID_OBJ_TYPES = 0x54595045 // 'TYPE'

type PackfileInfo = {
  name: string
  index: GitPackIndex
  oids: string[]
}

type ObjectInfo = {
  oid: string
  packfileIndex: number
  offset: number
  objectType?: string
}

/**
 * Writes a multi-pack-index file by scanning all packfiles
 */
export async function writeMultiPackIndex({
  fs,
  cache,
  gitdir,
  getExternalRefDelta,
  onProgress,
}: {
  fs: FsClient
  cache: Record<string | symbol, unknown>
  gitdir: string
  getExternalRefDelta: (oid: string) => Promise<unknown>
  onProgress?: ProgressCallback
}): Promise<Buffer> {
  // Scan all packfiles
  const packDir = join(gitdir, 'objects', 'pack')
  let packfiles = await fs.readdir(packDir)
  packfiles = (packfiles as string[]).filter((f: string) => f.endsWith('.pack'))

  if (packfiles.length === 0) {
    throw new InternalError('No packfiles found to index')
  }

  if (onProgress) {
    await onProgress({
      phase: 'Scanning packfiles',
      loaded: 0,
      total: packfiles.length,
    })
  }

  // Load all packfile indices
  const packfileInfos: PackfileInfo[] = []
  for (let i = 0; i < packfiles.length; i++) {
    const packfileName = packfiles[i] as string
    const indexFileName = packfileName.replace(/\.pack$/, '.idx')
    const indexPath = join(packDir, indexFileName)

    try {
      const idxData = await fs.read(indexPath)
      const idxBuffer = Buffer.isBuffer(idxData)
        ? idxData
        : Buffer.from(idxData as string | Uint8Array)
      const index = GitPackIndex.fromIdx({ idx: idxBuffer, getExternalRefDelta })

      if (index && index.hashes) {
        packfileInfos.push({
          name: packfileName,
          index,
          oids: [...index.hashes],
        })
      }

      if (onProgress) {
        await onProgress({
          phase: 'Scanning packfiles',
          loaded: i + 1,
          total: packfiles.length,
        })
      }
    } catch (err) {
      // Skip packfiles without indices
      continue
    }
  }

  if (packfileInfos.length === 0) {
    throw new InternalError('No valid packfile indices found')
  }

  // Collect all OIDs from all packfiles
  const allOids = new Set<string>()
  const oidToInfo = new Map<string, ObjectInfo>()

  for (let packIndex = 0; packIndex < packfileInfos.length; packIndex++) {
    const packInfo = packfileInfos[packIndex]
    for (const oid of packInfo.oids) {
      allOids.add(oid)
      const offset = packInfo.index.offsets.get(oid)
      if (offset !== undefined) {
        oidToInfo.set(oid, {
          oid,
          packfileIndex: packIndex,
          offset,
        })
      }
    }
  }

  // Sort OIDs
  const sortedOids = Array.from(allOids).sort()

  // Generate fanout table
  const fanout: number[] = new Array(256).fill(0)
  for (let i = 0; i < sortedOids.length; i++) {
    const oid = sortedOids[i]
    const firstByte = parseInt(oid.substring(0, 2), 16)
    for (let j = firstByte; j < 256; j++) {
      fanout[j]++
    }
  }

  // Check for large offsets (> 2GB)
  const hasLargeOffsets = Array.from(oidToInfo.values()).some(
    info => info.offset >= 0x80000000
  )

  // Collect object types if available (optional)
  const includeObjectTypes = true // Can be made configurable
  const objectTypes = new Map<string, string>()
  if (includeObjectTypes) {
    // We'd need to read objects to determine types, which is expensive
    // For now, we'll skip this or make it optional
  }

  // Build chunks
  const chunks: Array<{ id: number; offset: number; data: Buffer }> = []

  // Calculate header size: magic (4) + version (1) + objectIdVersion (1) + chunkCount (1) + baseMidx (1) + chunk table
  const chunkCount = hasLargeOffsets ? 5 : 4 // PNAM, OIDF, OIDL, OOFF, [LOFF]
  const headerSize = 4 + 1 + 1 + 1 + 1 + chunkCount * 8 // 8 bytes per chunk (4 for ID, 4 for offset)

  let currentOffset = headerSize

  // Packfile names chunk
  const packnamesBuffer = Buffer.alloc(4 + packfileInfos.reduce((sum, p) => sum + p.name.length + 1, 0))
  const packnamesCursor = new BufferCursor(packnamesBuffer)
  packnamesCursor.writeUInt32BE(packfileInfos.length)
  for (const packInfo of packfileInfos) {
    packnamesCursor.write(packInfo.name, packInfo.name.length, 'ascii')
    packnamesCursor.writeUInt8(0) // null terminator
  }
  chunks.push({ id: CHUNK_ID_PACKNAMES, offset: currentOffset, data: packnamesBuffer })
  currentOffset += packnamesBuffer.length
  // Align to 4-byte boundary
  currentOffset = Math.ceil(currentOffset / 4) * 4

  // OID fanout chunk
  const fanoutBuffer = Buffer.alloc(256 * 4)
  const fanoutCursor = new BufferCursor(fanoutBuffer)
  for (const count of fanout) {
    fanoutCursor.writeUInt32BE(count)
  }
  chunks.push({ id: CHUNK_ID_OIDFANOUT, offset: currentOffset, data: fanoutBuffer })
  currentOffset += fanoutBuffer.length

  // OID lookup chunk
  const oidLookupBuffer = Buffer.alloc(sortedOids.length * 20)
  const oidLookupCursor = new BufferCursor(oidLookupBuffer)
  for (const oid of sortedOids) {
    oidLookupCursor.write(oid, 20, 'hex')
  }
  chunks.push({ id: CHUNK_ID_OIDLOOKUP, offset: currentOffset, data: oidLookupBuffer })
  currentOffset += oidLookupBuffer.length

  // Object offsets chunk
  const objOffsetsBuffer = Buffer.alloc(sortedOids.length * 8)
  const objOffsetsCursor = new BufferCursor(objOffsetsBuffer)
  const largeOffsets: Array<{ oid: string; offset: number }> = []
  let largeOffsetIndex = 0

  for (let i = 0; i < sortedOids.length; i++) {
    const oid = sortedOids[i]
    const info = oidToInfo.get(oid)
    if (!info) {
      throw new InternalError(`Missing info for OID: ${oid}`)
    }

    objOffsetsCursor.writeUInt32BE(info.packfileIndex)

    if (info.offset >= 0x80000000 || hasLargeOffsets) {
      // Use large offset marker
      objOffsetsCursor.writeUInt32BE(largeOffsetIndex | 0x80000000)
      largeOffsets.push({ oid, offset: info.offset })
      largeOffsetIndex++
    } else {
      objOffsetsCursor.writeUInt32BE(info.offset)
    }
  }

  chunks.push({ id: CHUNK_ID_OBJOFFSETS, offset: currentOffset, data: objOffsetsBuffer })
  currentOffset += objOffsetsBuffer.length

  // Large offsets chunk (if needed)
  if (hasLargeOffsets && largeOffsets.length > 0) {
    const largeOffsetsBuffer = Buffer.alloc(4 + largeOffsets.length * 8)
    const largeOffsetsCursor = new BufferCursor(largeOffsetsBuffer)
    largeOffsetsCursor.writeUInt32BE(largeOffsets.length)
    for (const { offset } of largeOffsets) {
      // Write as 64-bit: lower 32 bits, then upper 32 bits
      const low = Number(BigInt(offset) & 0xffffffffn)
      const high = Number((BigInt(offset) >> 32n) & 0xffffffffn)
      largeOffsetsCursor.writeUInt32BE(low)
      largeOffsetsCursor.writeUInt32BE(high)
    }
    chunks.push({ id: CHUNK_ID_LARGE_OFFSETS, offset: currentOffset, data: largeOffsetsBuffer })
    currentOffset += largeOffsetsBuffer.length
  }

  // Object types chunk (optional, skipped for now as it requires reading objects)

  // Build the final buffer
  const totalSize = currentOffset + 20 // +20 for checksum
  const buffer = Buffer.alloc(totalSize)
  const writer = new BufferCursor(buffer)

  // Write header
  writer.write('MIDX', 4, 'ascii')
  writer.writeUInt8(1) // version
  writer.writeUInt8(1) // object ID version (SHA-1)
  writer.writeUInt8(chunks.length) // chunk count
  writer.writeUInt8(0) // base MIDX (0 = none)

  // Write chunk table
  for (const chunk of chunks) {
    writer.writeUInt32BE(chunk.id)
    writer.writeUInt32BE(chunk.offset)
  }

  // Write chunks
  for (const chunk of chunks) {
    writer.seek(chunk.offset)
    writer.copy(chunk.data, 0, chunk.data.length)
  }

  // Write checksum
  const dataToHash = buffer.slice(0, currentOffset)
  const checksum = await shasum(dataToHash)
  writer.seek(currentOffset)
  writer.write(checksum, 20, 'hex')

  return buffer
}

