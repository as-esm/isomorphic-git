import { getConfigValue } from './configAccess.ts'
import { assignDefined } from './assignDefined.ts'
import type { FsClient } from "../models/FileSystem.ts"
import type { Author, CommitObject } from "../models/GitCommit.ts"

/**
 * Return committer object by using properties with this priority:
 * (1) provided committer object
 * -> (2) provided author object
 * -> (3) committer of provided commit object
 * -> (4) Config and current date/time
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.gitdir] - The [git directory](dir-vs-gitdir.md) path
 * @param {Object} [args.author] - The author object.
 * @param {Object} [args.committer] - The committer object.
 * @param {CommitObject} [args.commit] - A commit object.
 *
 * @returns {Promise<void | {name: string, email: string, timestamp: number, timezoneOffset: number }>}
 */
export async function normalizeCommitterObject({
  fs,
  gitdir,
  author,
  committer,
  commit,
}: {
  fs: FsClient
  gitdir?: string
  author?: Partial<Author>
  committer?: Partial<Author>
  commit?: CommitObject
}): Promise<Author | undefined> {
  const timestamp = Math.floor(Date.now() / 1000)

  const nameConfig = (await getConfigValue(fs, gitdir || '', 'user.name')) as string | undefined
  const emailConfig = ((await getConfigValue(fs, gitdir || '', 'user.email')) as string | undefined) || '' // committer.email is allowed to be empty string
  
  const defaultCommitter: Partial<Author> = {
    name: nameConfig,
    email: emailConfig,
    timestamp,
    timezoneOffset: new Date(timestamp * 1000).getTimezoneOffset(),
  }

  const normalizedCommitter = assignDefined(
    {} as Partial<Author>,
    defaultCommitter,
    commit ? commit.committer : undefined,
    author,
    committer
  ) as Author

  if (normalizedCommitter.name === undefined) {
    return undefined
  }
  return normalizedCommitter
}

