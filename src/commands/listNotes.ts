import { _readTree } from './readTree.js'
import { NotFoundError } from '../errors/NotFoundError.js'
import { GitRefManager } from '../managers/GitRefManager.js'
import type { FsClient } from '../models/FileSystem.js'

/**
 * List all the object notes
 */
export async function _listNotes({
  fs,
  cache,
  gitdir,
  ref,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  ref: string
}): Promise<Array<{ target: string; note: string }>> {
  // Get the current note commit
  let parent: string | undefined
  try {
    parent = await GitRefManager.resolve({ gitdir, fs, ref })
  } catch (err) {
    if (err instanceof NotFoundError) {
      return []
    }
    throw err
  }

  if (!parent) {
    return []
  }

  // Create the current note tree
  const result = await _readTree({
    fs,
    cache,
    gitdir,
    oid: parent,
  })

  // Format the tree entries
  const notes = result.tree.map(entry => ({
    target: entry.path,
    note: entry.oid,
  }))
  return notes
}

