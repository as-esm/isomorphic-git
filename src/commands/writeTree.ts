import { GitTree } from "../models/GitTree.ts"
import { _writeObject as writeObject } from "../storage/writeObject.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { TreeObject } from "../models/GitTree.ts"

/**
 * @param {object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {TreeObject} args.tree
 *
 * @returns {Promise<string>}
 */
export async function _writeTree({ fs, gitdir, tree }: { fs: FsClient; gitdir: string; tree: TreeObject }): Promise<string> {
  // Convert object to buffer
  const object = GitTree.from(tree).toObject()
  const oid = await writeObject({
    fs,
    gitdir,
    type: 'tree',
    object,
    format: 'content',
  })
  return oid
}

