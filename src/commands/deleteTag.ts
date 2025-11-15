import { deleteRefs } from "../git/refs/deleteRef.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Delete a local tag ref
 *
 * @param {Object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {string} args.ref - The tag to delete
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.deleteTag({ dir: '$input((/))', ref: '$input((test-tag))' })
 * console.log('done')
 *
 */
export async function _deleteTag({ fs, gitdir, ref }: { fs: FsClient; gitdir: string; ref: string }): Promise<void> {
  ref = ref.startsWith('refs/tags/') ? ref : `refs/tags/${ref}`
  await deleteRefs({ fs, gitdir, refs: [ref] })
}

