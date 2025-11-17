import { readRef, writeRef, deleteRef } from '../index.ts'
import { readObject } from '../../objects/readObject.ts'
import { writeObject } from '../../objects/writeObject.ts'
import { parse as parseBlob } from '../../../core-utils/parsers/Blob.ts'
import { getNotesRef } from './readNote.ts'
import type { FsClient } from "../../../models/FileSystem.ts"
import type { TreeEntry } from "../../../models/GitTree.ts"

/**
 * Writes a note for a given object
 */
export const writeNote = async ({
  fs,
  gitdir,
  oid,
  note,
  namespace = 'commits',
  cache = {},
  force = false,
}: {
  fs: FsClient
  gitdir: string
  oid: string
  note: Buffer | string
  namespace?: string
  cache?: Record<string, unknown>
  force?: boolean
}): Promise<string> => {
  const notesRef = getNotesRef(namespace)

  // Convert note to buffer
  const noteBuffer = Buffer.isBuffer(note) ? note : Buffer.from(note, 'utf8')

  // Write the note blob
  const noteOid = await writeObject({ fs, gitdir, type: 'blob', object: noteBuffer })

  // Notes are stored in a fanout structure: first 2 hex chars / next 2 hex chars / rest
  const fanout1 = oid.slice(0, 2)
  const fanout2 = oid.slice(2, 4)
  const rest = oid.slice(4)

  // Get or create the notes tree
  let notesTreeOid: string
  try {
    const resolved = await readRef({ fs, gitdir, ref: notesRef })
    if (!resolved) throw new Error('Notes ref not found')
    notesTreeOid = resolved
  } catch {
    // Notes ref doesn't exist, create empty tree
    const { serialize: serializeTree } = await import('../../../core-utils/parsers/Tree.ts')
    const emptyTree = serializeTree([])
    notesTreeOid = await writeObject({ fs, gitdir, type: 'tree', object: emptyTree })
  }

  // Read the notes tree
  const { object: treeObject } = await readObject({ fs, cache, gitdir, oid: notesTreeOid })
  const { parse: parseTree, serialize: serializeTree } = await import('../../../core-utils/parsers/Tree.ts')
  let treeEntries = parseTree(treeObject as Buffer)

  // Find or create fanout1 entry
  let fanout1Entry = treeEntries.find(e => e.path === fanout1)
  let fanout2TreeOid: string

  if (!fanout1Entry) {
    // Create new fanout1 tree
    const emptyTree = serializeTree([])
    fanout2TreeOid = await writeObject({ fs, gitdir, type: 'tree', object: emptyTree })
    fanout1Entry = { path: fanout1, oid: fanout2TreeOid, mode: '040000', type: 'tree' }
    treeEntries.push(fanout1Entry)
  } else {
    fanout2TreeOid = fanout1Entry.oid
  }

  // Read the fanout2 tree
  const { object: fanout2TreeObject } = await readObject({ fs, cache, gitdir, oid: fanout2TreeOid })
  let fanout2Entries = parseTree(fanout2TreeObject as Buffer)

  // Add or update the note entry
  const noteEntry = fanout2Entries.find(e => e.path === rest)
  if (noteEntry) {
    if (!force) {
      throw new Error(`Note already exists for ${oid}. Use force=true to overwrite.`)
    }
    noteEntry.oid = noteOid
  } else {
    fanout2Entries.push({ path: rest, oid: noteOid, mode: '100644', type: 'blob' })
  }

  // Write the fanout2 tree
  const fanout2Tree = serializeTree(fanout2Entries)
  fanout2TreeOid = await writeObject({ fs, gitdir, type: 'tree', object: fanout2Tree })

  // Update fanout1 entry
  fanout1Entry.oid = fanout2TreeOid

  // Write the notes tree
  const notesTree = serializeTree(treeEntries)
  notesTreeOid = await writeObject({ fs, gitdir, type: 'tree', object: notesTree })

  // Update the notes ref
  await writeRef({ fs, gitdir, ref: notesRef, value: notesTreeOid })

  return notesTreeOid
}

/**
 * Deletes a note for a given object
 */
export const removeNote = async ({
  fs,
  gitdir,
  oid,
  namespace = 'commits',
  cache = {},
}: {
  fs: FsClient
  gitdir: string
  oid: string
  namespace?: string
  cache?: Record<string, unknown>
}): Promise<string | null> => {
  const notesRef = getNotesRef(namespace)

  try {
    const notesTreeOid = await readRef({ fs, gitdir, ref: notesRef })
    if (!notesTreeOid) return null

    const fanout1 = oid.slice(0, 2)
    const fanout2 = oid.slice(2, 4)
    const rest = oid.slice(4)

    // Read the notes tree
    const { object: treeObject } = await readObject({ fs, cache, gitdir, oid: notesTreeOid })
    const { parse: parseTree, serialize: serializeTree } = await import('../../../core-utils/parsers/Tree.ts')
    const treeEntries = parseTree(treeObject as Buffer)

    const fanout1Entry = treeEntries.find(e => e.path === fanout1)
    if (!fanout1Entry) return null

    // Read the fanout2 tree
    const { object: fanout2TreeObject } = await readObject({ fs, cache, gitdir, oid: fanout1Entry.oid })
    let fanout2Entries = parseTree(fanout2TreeObject as Buffer)

    // Remove the note entry
    const noteIndex = fanout2Entries.findIndex(e => e.path === rest)
    if (noteIndex === -1) return null

    fanout2Entries.splice(noteIndex, 1)

    // If fanout2 tree is empty, remove fanout1 entry too
    if (fanout2Entries.length === 0) {
      const fanout1Index = treeEntries.findIndex(e => e.path === fanout1)
      treeEntries.splice(fanout1Index, 1)

      // If notes tree is empty, delete the ref
      if (treeEntries.length === 0) {
        await deleteRef({ fs, gitdir, ref: notesRef })
        return null
      }
    } else {
      // Write the fanout2 tree
      const fanout2Tree = serializeTree(fanout2Entries)
      const fanout2TreeOid = await writeObject({ fs, gitdir, type: 'tree', object: fanout2Tree })

      // Update fanout1 entry
      fanout1Entry.oid = fanout2TreeOid
    }

    // Write the notes tree
    const notesTree = serializeTree(treeEntries)
    const newNotesTreeOid = await writeObject({ fs, gitdir, type: 'tree', object: notesTree })

    // Update the notes ref
    await writeRef({ fs, gitdir, ref: notesRef, value: newNotesTreeOid })

    return newNotesTreeOid
  } catch {
    // Note doesn't exist
    return null
  }
}

