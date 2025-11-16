import { GitCommit } from "../models/GitCommit.ts"
import { writeObject as writeObjectInternal } from "../git/objects/writeObject.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { CommitObject } from "../models/GitCommit.ts"

/**
 * Write a commit object directly
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {CommitObject} args.commit - The object to write
 *
 * @returns {Promise<string>} Resolves successfully with the SHA-1 object id of the newly written object
 * @see CommitObject
 *
 */
export async function writeCommit({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  commit,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  commit: CommitObject
}): Promise<string> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('commit', commit)

    const fs = normalizeFs(_fs)
    // Convert object to buffer
    const object = GitCommit.from(commit).toObject()
    const oid = await writeObjectInternal({
      fs,
      gitdir,
      type: 'commit',
      object,
      format: 'content',
    })
    return oid
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.writeCommit'
    throw err
  }
}

