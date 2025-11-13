import { GitAnnotatedTag } from "../models/GitAnnotatedTag.ts"
import { _writeObject as writeObject } from "../storage/writeObject.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { TagObject } from "../models/GitAnnotatedTag.ts"

/**
 * @param {object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {TagObject} args.tag
 *
 * @returns {Promise<string>}
 */
export async function _writeTag({ fs, gitdir, tag }: { fs: FsClient; gitdir: string; tag: TagObject }): Promise<string> {
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

