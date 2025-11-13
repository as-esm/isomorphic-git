import diff3Merge from 'diff3'
import { parse as parseTree, serialize as serializeTree } from '../parsers/Tree.js'
import { read as readObject } from '../odb/ObjectReader.js'
import { write as writeObject } from '../odb/ObjectWriter.js'
import type { FsClient } from "../../models/FileSystem.ts"
import type { TreeEntry } from "../../models/GitTree.ts"

// ============================================================================
// MERGE DRIVER TYPES
// ============================================================================

/**
 * Merge driver parameters
 */
export type MergeDriverParams = {
  branches: string[]
  contents: string[]
  path: string
}

/**
 * Merge driver callback
 */
export type MergeDriverCallback = (
  args: MergeDriverParams
) => { cleanMerge: boolean; mergedText: string } | Promise<{ cleanMerge: boolean; mergedText: string }>

const LINEBREAKS = /^.*(\r?\n|$)/gm

type MergeBlobsResult = {
  mergedContent: Buffer
  hasConflict: boolean
}

type MergeTreesResult = {
  mergedTree: TreeEntry[]
  mergedTreeOid: string
  conflicts: string[]
}

/**
 * Performs a three-way merge on blobs (text files)
 */
export const mergeBlobs = ({
  base,
  ours,
  theirs,
  ourName = 'ours',
  theirName = 'theirs',
}: {
  base: Buffer | string
  ours: Buffer | string
  theirs: Buffer | string
  ourName?: string
  theirName?: string
}): MergeBlobsResult => {
  const baseContent = typeof base === 'string' ? base : base.toString('utf8')
  const ourContent = typeof ours === 'string' ? ours : ours.toString('utf8')
  const theirContent = typeof theirs === 'string' ? theirs : theirs.toString('utf8')

  const oursLines = ourContent.match(LINEBREAKS) || []
  const baseLines = baseContent.match(LINEBREAKS) || []
  const theirsLines = theirContent.match(LINEBREAKS) || []

  // Use diff3 library for the heavy lifting
  const result = diff3Merge(oursLines, baseLines, theirsLines)

  const markerSize = 7
  let mergedText = ''
  let hasConflict = false

  for (const item of result) {
    if ('ok' in item && item.ok) {
      mergedText += item.ok.join('')
    }
    if ('conflict' in item && item.conflict) {
      hasConflict = true
      mergedText += `${'<'.repeat(markerSize)} ${ourName}\n`
      mergedText += item.conflict.a.join('')
      mergedText += `${'='.repeat(markerSize)}\n`
      mergedText += item.conflict.b.join('')
      mergedText += `${'>'.repeat(markerSize)} ${theirName}\n`
    }
  }

  return {
    mergedContent: Buffer.from(mergedText, 'utf8'),
    hasConflict,
  }
}

/**
 * Performs a recursive three-way merge on trees
 * Note: This is a simplified version - full implementation would need to handle
 * directory structures, deletions, and more complex conflict scenarios
 */
export const mergeTrees = async ({
  fs,
  cache,
  gitdir,
  base,
  ours,
  theirs,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  base: string | null
  ours: string
  theirs: string
}): Promise<MergeTreesResult> => {
  const conflicts: string[] = []
  const mergedEntries: TreeEntry[] = []

  // Read all three trees
  const baseTree = base ? await readTree(fs, cache, gitdir, base) : []
  const ourTree = await readTree(fs, cache, gitdir, ours)
  const theirTree = await readTree(fs, cache, gitdir, theirs)

  // Create maps for easy lookup
  const baseMap = new Map(baseTree.map(e => [e.path, e]))
  const ourMap = new Map(ourTree.map(e => [e.path, e]))
  const theirMap = new Map(theirTree.map(e => [e.path, e]))

  // Get all unique paths
  const allPaths = new Set([...baseMap.keys(), ...ourMap.keys(), ...theirMap.keys()])

  for (const path of allPaths) {
    const baseEntry = baseMap.get(path)
    const ourEntry = ourMap.get(path)
    const theirEntry = theirMap.get(path)

    const baseOid = baseEntry?.oid
    const ourOid = ourEntry?.oid
    const theirOid = theirEntry?.oid

    // Both unchanged
    if (ourOid === baseOid && theirOid === baseOid) {
      if (ourEntry) mergedEntries.push(ourEntry)
      continue
    }

    // Only theirs changed
    if (ourOid === baseOid && theirOid !== baseOid) {
      if (theirEntry) mergedEntries.push(theirEntry)
      continue
    }

    // Only ours changed
    if (ourOid !== baseOid && theirOid === baseOid) {
      if (ourEntry) mergedEntries.push(ourEntry)
      continue
    }

    // Both changed - need to merge
    if (ourOid !== baseOid && theirOid !== baseOid) {
      if (ourEntry?.type === 'tree' && theirEntry?.type === 'tree') {
        // Recursively merge subtrees
        const subtreeResult = await mergeTrees({
          fs,
          cache,
          gitdir,
          base: baseOid ?? null,
          ours: ourOid!,
          theirs: theirOid!,
        })

        if (subtreeResult.conflicts.length > 0) {
          conflicts.push(...subtreeResult.conflicts.map(c => `${path}/${c}`))
        }

        mergedEntries.push({
          mode: ourEntry.mode,
          path,
          oid: subtreeResult.mergedTreeOid,
          type: 'tree',
        })
      } else if (ourEntry?.type === 'blob' && theirEntry?.type === 'blob') {
        // Merge blobs
        const baseBlob = baseEntry ? await readBlob(fs, cache, gitdir, baseOid!) : Buffer.alloc(0)
        const ourBlob = await readBlob(fs, cache, gitdir, ourOid!)
        const theirBlob = await readBlob(fs, cache, gitdir, theirOid!)

        const { mergedContent, hasConflict } = mergeBlobs({
          base: baseBlob,
          ours: ourBlob,
          theirs: theirBlob,
        })

        if (hasConflict) {
          conflicts.push(path)
        }

        // Write merged blob
        const mergedOid = await writeObject({
          fs,
          gitdir,
          type: 'blob',
          object: mergedContent,
          format: 'content',
        })

        mergedEntries.push({
          mode: ourEntry.mode,
          path,
          oid: mergedOid,
          type: 'blob',
        })
      } else {
        // Type mismatch or other conflict
        conflicts.push(path)
        // For now, take ours
        if (ourEntry) mergedEntries.push(ourEntry)
      }
    }

    // Handle deletions
    if (!ourEntry && !theirEntry && baseEntry) {
      // Deleted by both - skip
      continue
    }

    if (!ourEntry && theirEntry && baseEntry) {
      // Deleted by us, modified by them - conflict
      conflicts.push(path)
      mergedEntries.push(theirEntry)
    }

    if (ourEntry && !theirEntry && baseEntry) {
      // Modified by us, deleted by them - conflict
      conflicts.push(path)
      mergedEntries.push(ourEntry)
    }
  }

  // Write merged tree
  const mergedTreeBuffer = serializeTree(mergedEntries)
  const mergedTreeOid = await writeObject({
    fs,
    gitdir,
    type: 'tree',
    object: mergedTreeBuffer,
    format: 'content',
  })

  return {
    mergedTree: mergedEntries,
    mergedTreeOid,
    conflicts,
  }
}

const readTree = async (
  fs: FsClient,
  cache: Record<string, unknown>,
  gitdir: string,
  oid: string
): Promise<TreeEntry[]> => {
  const { object } = await readObject({ fs, cache, gitdir, oid })
  return parseTree(object as Buffer)
}

const readBlob = async (
  fs: FsClient,
  cache: Record<string, unknown>,
  gitdir: string,
  oid: string
): Promise<Buffer> => {
  const { object } = await readObject({ fs, cache, gitdir, oid })
  return Buffer.from(object as Buffer)
}
