import { GitCommit } from "../models/GitCommit.ts"
import { _writeObject as writeObject } from "../storage/writeObject.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { CommitObject } from "../models/GitCommit.ts"

/**
 * @param {object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {CommitObject} args.commit
 *
 * @returns {Promise<string>}
 * @see CommitObject
 *
 */
export async function _writeCommit({ fs, gitdir, commit }: { fs: FsClient; gitdir: string; commit: CommitObject }): Promise<string> {
  // Convert object to buffer
  const object = GitCommit.from(commit).toObject()
  const oid = await writeObject({
    fs,
    gitdir,
    type: 'commit',
    object,
    format: 'content',
  })
  return oid
}

