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
  const normalized: TreeEntry = {
    oid: entry.oid ?? entry.sha ?? '',
    mode: limitModeToAllowed(entry.mode ?? '100644'),
    path: entry.path ?? '',
    type: entry.type ?? mode2type(limitModeToAllowed(entry.mode ?? '100644')),
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
  while (cursor < buf.length) {
    const space = buf.indexOf(32, cursor)
    if (space === -1) {
      throw new InternalError(
        `GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next space character.`
      )
    }
    const nullchar = buf.indexOf(0, cursor)
    if (nullchar === -1) {
      throw new InternalError(
        `GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next null character.`
      )
    }
    let mode = buf.slice(cursor, space).toString('utf8')
    if (mode === '40000') mode = '040000' // makes it line up neater in printed output
    const type = mode2type(mode)
    const path = buf.slice(space + 1, nullchar).toString('utf8')

    // Prevent malicious git repos from writing to "..\foo" on clone etc
    if (path.includes('\\') || path.includes('/')) {
      throw new UnsafeFilepathError(path)
    }

    const oid = buf.slice(nullchar + 1, nullchar + 21).toString('hex')
    cursor = nullchar + 21
    _entries.push({ mode, path, oid, type })
  }
  // Tree entries are not sorted alphabetically in the usual sense (see `compareTreeEntryPath`)
  // but it is important later on that these be sorted in the same order as they would be returned from readdir.
  _entries.sort(comparePath)
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

