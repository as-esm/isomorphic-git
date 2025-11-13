import { InternalError } from "../../errors/InternalError.ts"
import { UnsafeFilepathError } from "../../errors/UnsafeFilepathError.ts"
import { comparePath } from "../../utils/comparePath.ts"
import { compareTreeEntryPath } from "../../utils/compareTreeEntryPath.ts"
import type { TreeEntry } from "../../models/GitTree.ts"

const mode2type = (mode: string): 'tree' | 'blob' | 'commit' => {
  // prettier-ignore
  switch (mode) {
    case '040000': return 'tree'
    case '100644': return 'blob'
    case '100755': return 'blob'
    case '120000': return 'blob'
    case '160000': return 'commit'
  }
  throw new InternalError(`Unexpected GitTree entry mode: ${mode}`)
}

const limitModeToAllowed = (mode: string | number): string => {
  if (typeof mode === 'number') {
    mode = mode.toString(8)
  }
  const modeStr = String(mode)
  // tree
  if (modeStr.match(/^0?4.*/)) return '040000' // Directory
  if (modeStr.match(/^1006.*/)) return '100644' // Regular non-executable file
  if (modeStr.match(/^1007.*/)) return '100755' // Regular executable file
  if (modeStr.match(/^120.*/)) return '120000' // Symbolic link
  if (modeStr.match(/^160.*/)) return '160000' // Commit (git submodule reference)
  throw new InternalError(`Could not understand file mode: ${mode}`)
}

const nudgeIntoShape = (entry: Partial<TreeEntry> & { sha?: string }): TreeEntry => {
  // Handle case where mode might be a type string instead of a mode
  let mode: string
  if (entry.mode === 'tree' || entry.mode === 'blob' || entry.mode === 'commit') {
    // entry.mode is actually a type, derive mode from type
    mode = entry.mode === 'tree' ? '040000' : entry.mode === 'commit' ? '160000' : '100644'
  } else {
    mode = limitModeToAllowed(entry.mode ?? '100644')
  }
  
  const normalized: TreeEntry = {
    oid: entry.oid ?? entry.sha ?? '',
    mode,
    path: entry.path ?? '',
    type: entry.type ?? mode2type(mode),
  }
  return normalized
}

/**
 * Parses a tree buffer into an array of tree entries
 */
export const parse = (buffer: Buffer | Uint8Array): TreeEntry[] => {
  const _entries: TreeEntry[] = []
  let cursor = 0
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  // Handle empty tree (empty buffer)
  if (buf.length === 0) {
    return _entries
  }
  while (cursor < buf.length) {
    const space = buf.indexOf(32, cursor)
    if (space === -1) {
      throw new InternalError(
        `GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next space character.`
      )
    }
    // Find null character - match original parseBuffer: search from cursor
    // In valid git tree format: mode path\0oid, so nullchar should be after space
    let nullchar = buf.indexOf(0, cursor)
    if (nullchar === -1) {
      throw new InternalError(
        `GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next null character.`
      )
    }
    // Validate nullchar comes after space (path separator)
    if (nullchar < space) {
      // This shouldn't happen in valid git trees, but handle it
      nullchar = buf.indexOf(0, space + 1)
      if (nullchar === -1) {
        throw new InternalError(
          `GitTree: Error parsing buffer at byte location ${cursor}: Could not find null character after space.`
        )
      }
    }
    let mode = buf.slice(cursor, space).toString('utf8')
    if (mode === '40000') mode = '040000' // makes it line up neater in printed output
    // Handle invalid mode strings that might be type strings (shouldn't happen in valid git trees)
    if (mode === 'tree' || mode === 'blob' || mode === 'commit') {
      mode = mode === 'tree' ? '040000' : mode === 'commit' ? '160000' : '100644'
    }
    const type = mode2type(mode)
    const path = buf.slice(space + 1, nullchar).toString('utf8')

    // Prevent malicious git repos from writing to "..\foo" on clone etc
    if (path.includes('\\') || path.includes('/')) {
      throw new UnsafeFilepathError(path)
    }

    // Extract oid - it's exactly 20 bytes (40 hex chars) after the null character
    if (nullchar + 21 > buf.length) {
      // If we're at the end of the buffer, this might be a malformed entry
      // Check if this is the end of the buffer (empty tree or truncated)
      if (nullchar === buf.length - 1 && cursor === 0) {
        // This looks like an empty or malformed tree - return empty entries
        return _entries
      }
      throw new InternalError(
        `GitTree: Error parsing buffer at byte location ${cursor}: Not enough bytes for oid (need 21 bytes after null at position ${nullchar}, have ${buf.length - nullchar - 1}, buffer length=${buf.length})`
      )
    }
    const oid = buf.slice(nullchar + 1, nullchar + 21).toString('hex')
    cursor = nullchar + 21
    // Validate that we have valid path and oid before adding
    if (!path || !oid || oid.length !== 40) {
      throw new InternalError(`Invalid tree entry: path="${path}", oid="${oid}" (length=${oid?.length || 0})`)
    }
    _entries.push({ mode, path, oid, type })
  }
  // Tree entries must be sorted using compareTreeEntryPath to match git's sorting
  // (Git sorts tree entries as if there is a trailing slash on directory names)
  // This ensures consistent serialization/deserialization
  _entries.sort(compareTreeEntryPath)
  return _entries
}

/**
 * Serializes an array of tree entries into a tree buffer
 */
export const serialize = (entries: TreeEntry[]): Buffer => {
  // Normalize entries
  const normalizedEntries = entries.map(nudgeIntoShape)

  // Adjust the sort order to match git's
  const sortedEntries = [...normalizedEntries]
  sortedEntries.sort(compareTreeEntryPath)

  return Buffer.concat(
    sortedEntries.map(entry => {
      const mode = Buffer.from(entry.mode.replace(/^0/, ''))
      const space = Buffer.from(' ')
      const path = Buffer.from(entry.path, 'utf8')
      const nullchar = Buffer.from([0])
      const oid = Buffer.from(entry.oid, 'hex')
      return Buffer.concat([mode, space, path, nullchar, oid])
    })
  )
}

