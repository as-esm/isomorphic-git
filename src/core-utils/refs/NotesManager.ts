import { RefManager } from './RefManager.js'
import { ObjectReader, ObjectWriter } from '../odb/index.js'
import { parse as parseBlob } from '../parsers/Blob.js'
import type { FsClient } from "../../models/FileSystem.ts"
import type { TreeEntry } from "../../models/GitTree.ts"

/**
 * Gets the notes ref for a given namespace
 */
export const getNotesRef = (namespace = 'commits'): string => {
  return `refs/notes/${namespace}`
}

/**
 * Reads a note for a given object
 */
export const readNote = async ({
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
}): Promise<Buffer | null> => {
  const notesRef = getNotesRef(namespace)

  try {
    // Get the notes tree OID
    const notesTreeOid = await RefManager.resolve({ fs, gitdir, ref: notesRef })

    // Notes are stored in a fanout structure: first 2 hex chars / next 2 hex chars / rest
    const fanout1 = oid.slice(0, 2)
    const fanout2 = oid.slice(2, 4)

    // Read the notes tree
    const { object: treeObject } = await ObjectReader.read({ fs, cache, gitdir, oid: notesTreeOid })
    const { parse: parseTree } = await import('../parsers/Tree.js')
    const treeEntries = parseTree(treeObject as Buffer)

    // Find the fanout1 entry
    const fanout1Entry = treeEntries.find(e => e.path === fanout1)
    if (!fanout1Entry) return null

    // Read the fanout2 tree
    const { object: fanout2TreeObject } = await ObjectReader.read({ fs, cache, gitdir, oid: fanout1Entry.oid })
    const fanout2Entries = parseTree(fanout2TreeObject as Buffer)

    // Find the fanout2 entry
    const fanout2Entry = fanout2Entries.find(e => e.path === fanout2)
    if (!fanout2Entry) return null

    // Read the note blob
    const { object: noteObject } = await ObjectReader.read({ fs, cache, gitdir, oid: fanout2Entry.oid })
    return parseBlob(noteObject as Buffer)
  } catch {
    // Note doesn't exist
    return null
  }
}

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
  const noteOid = await ObjectWriter.write({ fs, gitdir, type: 'blob', content: noteBuffer })

  // Notes are stored in a fanout structure: first 2 hex chars / next 2 hex chars / rest
  const fanout1 = oid.slice(0, 2)
  const fanout2 = oid.slice(2, 4)
  const rest = oid.slice(4)

  // Get or create the notes tree
  let notesTreeOid: string
  try {
    notesTreeOid = await RefManager.resolve({ fs, gitdir, ref: notesRef })
  } catch {
    // Notes ref doesn't exist, create empty tree
    const { serialize: serializeTree } = await import('../parsers/Tree.js')
    const emptyTree = serializeTree([])
    notesTreeOid = await ObjectWriter.write({ fs, gitdir, type: 'tree', content: emptyTree })
  }

  // Read the notes tree
  const { object: treeObject } = await ObjectReader.read({ fs, cache, gitdir, oid: notesTreeOid })
  const { parse: parseTree, serialize: serializeTree } = await import('../parsers/Tree.js')
  let treeEntries = parseTree(treeObject as Buffer)

  // Find or create fanout1 entry
  let fanout1Entry = treeEntries.find(e => e.path === fanout1)
  let fanout2TreeOid: string

  if (!fanout1Entry) {
    // Create new fanout1 tree
    const emptyTree = serializeTree([])
    fanout2TreeOid = await ObjectWriter.write({ fs, gitdir, type: 'tree', content: emptyTree })
    fanout1Entry = { path: fanout1, oid: fanout2TreeOid, mode: '040000', type: 'tree' }
    treeEntries.push(fanout1Entry)
  } else {
    fanout2TreeOid = fanout1Entry.oid
  }

  // Read the fanout2 tree
  const { object: fanout2TreeObject } = await ObjectReader.read({ fs, cache, gitdir, oid: fanout2TreeOid })
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
  fanout2TreeOid = await ObjectWriter.write({ fs, gitdir, type: 'tree', content: fanout2Tree })

  // Update fanout1 entry
  fanout1Entry.oid = fanout2TreeOid

  // Write the notes tree
  const notesTree = serializeTree(treeEntries)
  notesTreeOid = await ObjectWriter.write({ fs, gitdir, type: 'tree', content: notesTree })

  // Update the notes ref
  await RefManager.writeRef({ fs, gitdir, ref: notesRef, value: notesTreeOid })

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
    const notesTreeOid = await RefManager.resolve({ fs, gitdir, ref: notesRef })

    const fanout1 = oid.slice(0, 2)
    const fanout2 = oid.slice(2, 4)
    const rest = oid.slice(4)

    // Read the notes tree
    const { object: treeObject } = await ObjectReader.read({ fs, cache, gitdir, oid: notesTreeOid })
    const { parse: parseTree, serialize: serializeTree } = await import('../parsers/Tree.js')
    const treeEntries = parseTree(treeObject as Buffer)

    const fanout1Entry = treeEntries.find(e => e.path === fanout1)
    if (!fanout1Entry) return null

    // Read the fanout2 tree
    const { object: fanout2TreeObject } = await ObjectReader.read({ fs, cache, gitdir, oid: fanout1Entry.oid })
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
        await RefManager.deleteRef({ fs, gitdir, ref: notesRef })
        return null
      }
    } else {
      // Write the fanout2 tree
      const fanout2Tree = serializeTree(fanout2Entries)
      const fanout2TreeOid = await ObjectWriter.write({ fs, gitdir, type: 'tree', content: fanout2Tree })

      // Update fanout1 entry
      fanout1Entry.oid = fanout2TreeOid
    }

    // Write the notes tree
    const notesTree = serializeTree(treeEntries)
    const newNotesTreeOid = await ObjectWriter.write({ fs, gitdir, type: 'tree', content: notesTree })

    // Update the notes ref
    await RefManager.writeRef({ fs, gitdir, ref: notesRef, value: newNotesTreeOid })

    return newNotesTreeOid
  } catch {
    // Note doesn't exist
    return null
  }
}
