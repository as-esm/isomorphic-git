import { InternalError } from '../../errors/InternalError.ts'
import { UnsafeFilepathError } from '../../errors/UnsafeFilepathError.ts'
import { BufferCursor } from "../../utils/BufferCursor.ts"
import { comparePath } from "../../utils/comparePath.ts"
import { normalizeStats } from "../../utils/normalizeStats.ts"
import { shasum } from "../../utils/shasum.ts"
import type { Stat } from '../../models/FileSystem.ts'

type CacheEntryFlags = {
  assumeValid: boolean
  extended: boolean
  stage: number
  nameLength: number
  skipWorktree?: boolean
  intentToAdd?: boolean
}

type IndexEntry = {
  path: string
  oid: string
  mode: number
  ctimeSeconds: number
  ctimeNanoseconds: number
  mtimeSeconds: number
  mtimeNanoseconds: number
  dev: number
  ino: number
  uid: number
  gid: number
  size: number
  flags: CacheEntryFlags
  stages: IndexEntry[]
}

// Extract 1-bit assume-valid, 1-bit extended flag, 2-bit merge state flag, 12-bit path length flag
function parseCacheEntryFlags(bits: number): CacheEntryFlags {
  return {
    assumeValid: Boolean(bits & 0b1000000000000000),
    extended: Boolean(bits & 0b0100000000000000),
    stage: (bits & 0b0011000000000000) >> 12,
    nameLength: bits & 0b0000111111111111,
  }
}

function renderCacheEntryFlags(entry: IndexEntry): number {
  const flags = entry.flags
  // 1-bit extended flag (must be zero in version 2)
  flags.extended = false
  // 12-bit name length if the length is less than 0xFFF; otherwise 0xFFF
  // is stored in this field.
  flags.nameLength = Math.min(Buffer.from(entry.path).length, 0xfff)
  return (
    (flags.assumeValid ? 0b1000000000000000 : 0) +
    (flags.extended ? 0b0100000000000000 : 0) +
    ((flags.stage & 0b11) << 12) +
    (flags.nameLength & 0b111111111111)
  )
}

export class GitIndex {
  // Unique ID for debugging - helps track index instances across operations
  public readonly id = Math.random()
  
  _entries: Map<string, IndexEntry>
  _dirty: boolean // Used to determine if index needs to be saved to filesystem
  _unmergedPaths: Set<string>
  _version: number // Track index version (2 or 3)

  constructor(
    entries?: Map<string, IndexEntry> | null,
    unmergedPaths?: Set<string>,
    version: number = 2
  ) {
    this._dirty = false
    this._unmergedPaths = unmergedPaths || new Set()
    this._entries = entries || new Map()
    this._version = version
  }

  _addEntry(entry: IndexEntry): void {
    if (entry.flags.stage === 0) {
      entry.stages = [entry]
      this._entries.set(entry.path, entry)
      this._unmergedPaths.delete(entry.path)
    } else {
      let existingEntry = this._entries.get(entry.path)
      if (!existingEntry) {
        this._entries.set(entry.path, entry)
        existingEntry = entry
      }
      existingEntry.stages[entry.flags.stage] = entry
      this._unmergedPaths.add(entry.path)
    }
  }

  static async from(
    buffer: Buffer | Uint8Array | null
  ): Promise<GitIndex> {
    if (Buffer.isBuffer(buffer) || buffer instanceof Uint8Array) {
      return GitIndex.fromBuffer(buffer)
    } else if (buffer === null) {
      return new GitIndex(null)
    } else {
      throw new InternalError('invalid type passed to GitIndex.from')
    }
  }

  static async fromBuffer(buffer: Buffer | Uint8Array): Promise<GitIndex> {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
    if (buf.length === 0) {
      throw new InternalError('Index file is empty (.git/index)')
    }

    const index = new GitIndex()
    const reader = new BufferCursor(buf)
    const magic = reader.toString('utf8', 4)
    if (magic !== 'DIRC') {
      throw new InternalError(`Invalid dircache magic file number: ${magic}`)
    }

    // Verify shasum after we ensured that the file has a magic number
    const shaComputed = await shasum(buf.slice(0, -20))
    const shaClaimed = buf.slice(-20).toString('hex')
    if (shaClaimed !== shaComputed) {
      throw new InternalError(
        `Invalid checksum in GitIndex buffer: expected ${shaClaimed} but saw ${shaComputed}`
      )
    }

    const version = reader.readUInt32BE()
    if (version !== 2 && version !== 3) {
      throw new InternalError(`Unsupported dircache version: ${version}`)
    }
    index._version = version
    const numEntries = reader.readUInt32BE()
    let i = 0
    while (!reader.eof() && i < numEntries) {
      const entry: Partial<IndexEntry> = {}
      entry.ctimeSeconds = reader.readUInt32BE()
      entry.ctimeNanoseconds = reader.readUInt32BE()
      entry.mtimeSeconds = reader.readUInt32BE()
      entry.mtimeNanoseconds = reader.readUInt32BE()
      entry.dev = reader.readUInt32BE()
      entry.ino = reader.readUInt32BE()
      entry.mode = reader.readUInt32BE()
      entry.uid = reader.readUInt32BE()
      entry.gid = reader.readUInt32BE()
      entry.size = reader.readUInt32BE()
      entry.oid = reader.slice(20).toString('hex')
      const flags = reader.readUInt16BE()
      entry.flags = parseCacheEntryFlags(flags)
      
      // Version 3: Read extended flags if present
      if (version === 3 && entry.flags.extended) {
        const extendedFlags = reader.readUInt16BE()
        // Add skipWorktree and intentToAdd to flags if they exist
        ;(entry.flags as any).skipWorktree = Boolean(extendedFlags & 0b0000000000000001)
        ;(entry.flags as any).intentToAdd = Boolean(extendedFlags & 0b0000000000000010)
        // Reserved bits should be zero
        if (extendedFlags & 0b1111111111111100) {
          throw new InternalError(`Reserved extended flag bits are set: ${extendedFlags.toString(2)}`)
        }
      }
      
      // Handle pathname: if nameLength is 0xFFF, the actual length is stored separately
      let pathlength: number
      if (entry.flags.nameLength === 0xfff) {
        // Large pathname: read actual length from next 2 bytes
        pathlength = reader.readUInt16BE()
      } else {
        pathlength = entry.flags.nameLength
      }
      
      // Find null terminator for path
      const nullPos = buf.indexOf(0, reader.tell())
      if (nullPos === -1) {
        throw new InternalError('Could not find null terminator for path')
      }
      const actualPathLength = nullPos - reader.tell()
      if (actualPathLength < 1) {
        throw new InternalError(`Got a path length of: ${actualPathLength}`)
      }
      
      entry.path = reader.toString('utf8', actualPathLength)

      // Prevent malicious paths like "..\foo"
      if (entry.path && (entry.path.includes('..\\') || entry.path.includes('../'))) {
        throw new UnsafeFilepathError(entry.path)
      }

      // The next bit is awkward. We expect 1 to 8 null characters
      // such that the total size of the entry is a multiple of 8 bits.
      // (Hence subtract 12 bytes for the header.)
      let padding = 8 - ((reader.tell() - 12) % 8)
      if (padding === 0) padding = 8
      while (padding--) {
        const tmp = reader.readUInt8()
        if (tmp !== 0) {
          throw new InternalError(
            `Expected 1-8 null characters but got '${tmp}' after ${entry.path}`
          )
        } else if (reader.eof()) {
          throw new InternalError('Unexpected end of file')
        }
      }
      // end of awkward part
      entry.stages = []

      if (
        entry.path &&
        entry.oid &&
        entry.mode !== undefined &&
        entry.ctimeSeconds !== undefined &&
        entry.ctimeNanoseconds !== undefined &&
        entry.mtimeSeconds !== undefined &&
        entry.mtimeNanoseconds !== undefined &&
        entry.dev !== undefined &&
        entry.ino !== undefined &&
        entry.uid !== undefined &&
        entry.gid !== undefined &&
        entry.size !== undefined &&
        entry.flags
      ) {
        index._addEntry(entry as IndexEntry)
      }

      i++
    }
    return index
  }

  get unmergedPaths(): string[] {
    return [...this._unmergedPaths]
  }

  get entries(): IndexEntry[] {
    return [...this._entries.values()].sort(comparePath)
  }

  get entriesMap(): Map<string, IndexEntry> {
    return this._entries
  }

  get entriesFlat(): IndexEntry[] {
    return [...this.entries].flatMap(entry => {
      return entry.stages.length > 1 ? entry.stages.filter(x => x) : [entry]
    })
  }

  *[Symbol.iterator](): Generator<IndexEntry, void, unknown> {
    for (const entry of this.entries) {
      yield entry
    }
  }

  insert({
    filepath,
    stats,
    oid,
    stage = 0,
  }: {
    filepath: string
    stats?: Stat | null
    oid: string
    stage?: number
  }): void {
    let finalStats: Stat
    if (!stats) {
      finalStats = {
        ctimeSeconds: 0,
        ctimeNanoseconds: 0,
        mtimeSeconds: 0,
        mtimeNanoseconds: 0,
        dev: 0,
        ino: 0,
        mode: 0,
        uid: 0,
        gid: 0,
        size: 0,
      }
    } else {
      finalStats = normalizeStats(stats)
    }
    const bfilepath = Buffer.from(filepath)
    const entry: IndexEntry = {
      ctimeSeconds: finalStats.ctimeSeconds,
      ctimeNanoseconds: finalStats.ctimeNanoseconds,
      mtimeSeconds: finalStats.mtimeSeconds,
      mtimeNanoseconds: finalStats.mtimeNanoseconds,
      dev: finalStats.dev,
      ino: finalStats.ino,
      // We provide a fallback value for `mode` here because not all fs
      // implementations assign it, but we use it in GitTree.
      // '100644' is for a "regular non-executable file"
      mode: finalStats.mode || 0o100644,
      uid: finalStats.uid,
      gid: finalStats.gid,
      size: finalStats.size,
      path: filepath,
      oid,
      flags: {
        assumeValid: false,
        extended: false,
        stage,
        nameLength: bfilepath.length < 0xfff ? bfilepath.length : 0xfff,
      },
      stages: [],
    }

    this._addEntry(entry)

    this._dirty = true
  }

  delete({ filepath }: { filepath: string }): void {
    if (this._entries.has(filepath)) {
      this._entries.delete(filepath)
    } else {
      for (const key of this._entries.keys()) {
        if (key.startsWith(filepath + '/')) {
          this._entries.delete(key)
        }
      }
    }

    if (this._unmergedPaths.has(filepath)) {
      this._unmergedPaths.delete(filepath)
    }
    this._dirty = true
  }

  clear(): void {
    this._entries.clear()
    this._dirty = true
  }

  has({ filepath }: { filepath: string }): boolean {
    return this._entries.has(filepath)
  }

  render(): string {
    return this.entries
      .map(entry => `${entry.mode.toString(8)} ${entry.oid}    ${entry.path}`)
      .join('\n')
  }

  static async _entryToBuffer(entry: IndexEntry): Promise<Buffer> {
    const bpath = Buffer.from(entry.path)
    // the fixed length + the filename + at least one null char => align by 8
    const length = Math.ceil((62 + bpath.length + 1) / 8) * 8
    const written = Buffer.alloc(length)
    const writer = new BufferCursor(written)
    const stat = normalizeStats(entry)
    writer.writeUInt32BE(stat.ctimeSeconds)
    writer.writeUInt32BE(stat.ctimeNanoseconds)
    writer.writeUInt32BE(stat.mtimeSeconds)
    writer.writeUInt32BE(stat.mtimeNanoseconds)
    writer.writeUInt32BE(stat.dev)
    writer.writeUInt32BE(stat.ino)
    writer.writeUInt32BE(stat.mode)
    writer.writeUInt32BE(stat.uid)
    writer.writeUInt32BE(stat.gid)
    writer.writeUInt32BE(stat.size)
    writer.write(entry.oid, 20, 'hex')
    writer.writeUInt16BE(renderCacheEntryFlags(entry))
    writer.write(entry.path, bpath.length, 'utf8')
    return written
  }

  async toObject(): Promise<Buffer> {
    // Use the serialize function from Index.ts to ensure proper version 3 support
    // Convert GitIndex to IndexObject format
    const { serialize } = await import('../../core-utils/index/Index.ts')
    const indexObject = {
      entries: this._entries,
      unmergedPaths: this._unmergedPaths,
      version: this._version,
    }
    return await serialize(indexObject)
  }
}

