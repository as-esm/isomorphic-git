import { readTree } from './readTree.ts'
import { NotFoundError } from "../errors/NotFoundError.ts"
import { resolveRef } from "../git/refs/readRef.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * List all the object notes
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.ref] - The notes ref to look under
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<Array<{target: string, note: string}>>} Resolves successfully with an array of entries containing SHA-1 object ids of the note and the object the note targets
 */
export async function listNotes({
  fs: _fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  ref = 'refs/notes/commits',
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  ref?: string
  cache?: Record<string, unknown>
}): Promise<Array<{ target: string; note: string }>> {
  try {
    assertParameter('fs', _fs)
    if (!gitdir) {
      throw new Error('gitdir is required')
    }
    assertParameter('gitdir', gitdir)
    assertParameter('ref', ref)

    const fs = normalizeFs(_fs)
    // Get the current note commit
    let parent: string | undefined
    try {
      parent = await resolveRef({ fs, gitdir, ref })
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
    const result = await readTree({
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
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.listNotes'
    throw err
  }
}

