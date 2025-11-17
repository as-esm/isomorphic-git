import { readRef } from '../readRef.ts'
import { readObject } from '../../objects/readObject.ts'
import { parse as parseBlob } from '../../../core-utils/parsers/Blob.ts'
import type { FsClient } from "../../../models/FileSystem.ts"

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
    const notesTreeOid = await readRef({ fs, gitdir, ref: notesRef })

    if (!notesTreeOid) return null

    // Notes are stored in a fanout structure: first 2 hex chars / next 2 hex chars / rest
    const fanout1 = oid.slice(0, 2)
    const fanout2 = oid.slice(2, 4)

    // Read the notes tree
    const { object: treeObject } = await readObject({ fs, cache, gitdir, oid: notesTreeOid })
    const { parse: parseTree } = await import('../../../core-utils/parsers/Tree.ts')
    const treeEntries = parseTree(treeObject as Buffer)

    // Find the fanout1 entry
    const fanout1Entry = treeEntries.find(e => e.path === fanout1)
    if (!fanout1Entry) return null

    // Read the fanout2 tree
    const { object: fanout2TreeObject } = await readObject({ fs, cache, gitdir, oid: fanout1Entry.oid })
    const fanout2Entries = parseTree(fanout2TreeObject as Buffer)

    // Find the fanout2 entry
    const fanout2Entry = fanout2Entries.find(e => e.path === fanout2)
    if (!fanout2Entry) return null

    // Read the note blob
    const { object: noteObject } = await readObject({ fs, cache, gitdir, oid: fanout2Entry.oid })
    return parseBlob(noteObject as Buffer)
  } catch {
    // Note doesn't exist
    return null
  }
}

