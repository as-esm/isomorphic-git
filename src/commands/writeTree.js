// @ts-check
import '../typedefs.js'

import { GitTree } from "../models/GitTree.ts"
import { _writeObject as writeObject } from "../storage/writeObject.ts"

/**
 * @param {object} args
 * @param {import('../types.js').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {TreeObject} args.tree
 *
 * @returns {Promise<string>}
 */
export async function _writeTree({ fs, gitdir, tree }) {
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
