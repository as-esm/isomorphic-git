import { _writeTree } from '../commands/writeTree.js'
import { normalizeFs } from '../utils/normalizeFs.js'
import { assertParameter } from '../utils/assertParameter.js'
import { join } from '../utils/join.js'
import type { FsClient } from '../models/FileSystem.js'
import type { TreeObject } from '../models/GitTree.js'

/**
 * Write a tree object directly
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {TreeObject} args.tree - The object to write
 *
 * @returns {Promise<string>} Resolves successfully with the SHA-1 object id of the newly written object.
 * @see TreeObject
 * @see TreeEntry
 *
 */
export async function writeTree({
  fs,
  dir,
  gitdir = join(dir, '.git'),
  tree,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  tree: TreeObject
}): Promise<string> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir)
    assertParameter('tree', tree)

    return await _writeTree({
      fs: normalizeFs(fs),
      gitdir,
      tree,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.writeTree'
    throw err
  }
}

