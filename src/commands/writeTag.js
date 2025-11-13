// @ts-check
import '../typedefs.js'

import { GitAnnotatedTag } from "../models/GitAnnotatedTag.ts"
import { _writeObject as writeObject } from "../storage/writeObject.ts"

/**
 * @param {object} args
 * @param {import('../types.js').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {TagObject} args.tag
 *
 * @returns {Promise<string>}
 */
export async function _writeTag({ fs, gitdir, tag }) {
  // Convert object to buffer
  const object = GitAnnotatedTag.from(tag).toObject()
  const oid = await writeObject({
    fs,
    gitdir,
    type: 'tag',
    object,
    format: 'content',
  })
  return oid
}
