import { InternalError } from '../errors/InternalError.js'
import { UnsafeFilepathError } from '../errors/UnsafeFilepathError.js'
import { comparePath } from '../utils/comparePath.js'
import { compareTreeEntryPath } from '../utils/compareTreeEntryPath.js'
import type { ObjectType } from './GitObject.js'

// ============================================================================
// GIT TREE TYPES
// ============================================================================

/**
 * Git tree entry (file or directory in a tree)
 */
export type TreeEntry = {
  mode: string // 6 digit hexadecimal mode
  path: string // Name of the file or directory
  oid: string // SHA-1 object id of the blob or tree
  type: ObjectType
}

/**
 * Git tree object (array of tree entries)
 */
export type TreeObject = TreeEntry[]

/**
 * Result of reading a tree object
 */
export type ReadTreeResult = {
  oid: string // SHA-1 object id of this tree
  tree: TreeObject
}

function mode2type(mode: string): 'tree' | 'blob' | 'commit' {
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

function parseBuffer(buffer: Buffer): TreeEntry[] {
  const _entries: TreeEntry[] = []
  let cursor = 0
  while (cursor < buffer.length) {
    const space = buffer.indexOf(32, cursor)
    if (space === -1) {
      throw new InternalError(
        `GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next space character.`
      )
    }
    const nullchar = buffer.indexOf(0, cursor)
    if (nullchar === -1) {
      throw new InternalError(
        `GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next null character.`
      )
    }
    let mode = buffer.slice(cursor, space).toString('utf8')
    if (mode === '40000') mode = '040000' // makes it line up neater in printed output
    const type = mode2type(mode)
    const path = buffer.slice(space + 1, nullchar).toString('utf8')

    // Prevent malicious git repos from writing to "..\foo" on clone etc
    if (path.includes('\\') || path.includes('/')) {
      throw new UnsafeFilepathError(path)
    }

    const oid = buffer.slice(nullchar + 1, nullchar + 21).toString('hex')
    cursor = nullchar + 21
    _entries.push({ mode, path, oid, type })
  }
  return _entries
}

function limitModeToAllowed(mode: string | number): string {
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

function nudgeIntoShape(
  entry: Partial<TreeEntry> & { sha?: string; mode?: string | number }
): TreeEntry {
  if (!entry.oid && entry.sha) {
    entry.oid = entry.sha // Github
  }
  if (!entry.mode) {
    throw new InternalError('Entry missing mode')
  }
  entry.mode = limitModeToAllowed(entry.mode) // index
  if (!entry.type) {
    entry.type = mode2type(entry.mode)
  }
  if (!entry.path || !entry.oid) {
    throw new InternalError('Entry missing path or oid')
  }
  return {
    mode: entry.mode,
    path: entry.path,
    oid: entry.oid,
    type: entry.type,
  }
}

export class GitTree {
  private _entries: TreeEntry[]

  constructor(entries: Buffer | TreeEntry[] | Array<Partial<TreeEntry> & { sha?: string }>) {
    if (Buffer.isBuffer(entries)) {
      this._entries = parseBuffer(entries)
    } else if (Array.isArray(entries)) {
      this._entries = entries.map(nudgeIntoShape)
    } else {
      throw new InternalError('invalid type passed to GitTree constructor')
    }
    // Tree entries are not sorted alphabetically in the usual sense (see `compareTreeEntryPath`)
    // but it is important later on that these be sorted in the same order as they would be returned from readdir.
    this._entries.sort(comparePath)
  }

  static from(
    tree: Buffer | TreeEntry[] | Array<Partial<TreeEntry> & { sha?: string }>
  ): GitTree {
    return new GitTree(tree)
  }

  render(): string {
    return this._entries
      .map(entry => `${entry.mode} ${entry.type} ${entry.oid}    ${entry.path}`)
      .join('\n')
  }

  toObject(): Buffer {
    // Adjust the sort order to match git's
    const entries = [...this._entries]
    entries.sort(compareTreeEntryPath)
    return Buffer.concat(
      entries.map(entry => {
        const mode = Buffer.from(entry.mode.replace(/^0/, ''))
        const space = Buffer.from(' ')
        const path = Buffer.from(entry.path, 'utf8')
        const nullchar = Buffer.from([0])
        const oid = Buffer.from(entry.oid, 'hex')
        return Buffer.concat([mode, space, path, nullchar, oid])
      })
    )
  }

  /**
   * @returns {TreeEntry[]}
   */
  entries(): TreeEntry[] {
    return this._entries
  }

  *[Symbol.iterator](): Generator<TreeEntry, void, unknown> {
    for (const entry of this._entries) {
      yield entry
    }
  }
}

