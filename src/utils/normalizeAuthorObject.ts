import { getConfigValue } from './configAccess.ts'
import { assignDefined } from './assignDefined.ts'
import type { FsClient } from "../models/FileSystem.ts"
import type { Author, CommitObject } from "../models/GitCommit.ts"

/**
 * Return author object by using properties following this priority:
 * (1) provided author object
 * -> (2) author of provided commit object
 * -> (3) Config and current date/time
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.gitdir] - The [git directory](dir-vs-gitdir.md) path
 * @param {Object} [args.author] - The author object.
 * @param {CommitObject} [args.commit] - A commit object.
 *
 * @returns {Promise<void | {name: string, email: string, timestamp: number, timezoneOffset: number }>}
 */
export async function normalizeAuthorObject({
  fs,
  gitdir,
  author,
  commit,
}: {
  fs: FsClient
  gitdir?: string
  author?: Partial<Author>
  commit?: CommitObject
}): Promise<Author | undefined> {
  const timestamp = Math.floor(Date.now() / 1000)

  const nameConfig = (await getConfigValue(fs, gitdir || '', 'user.name')) as string | undefined
  const emailConfig = ((await getConfigValue(fs, gitdir || '', 'user.email')) as string | undefined) || '' // author.email is allowed to be empty string
  
  const defaultAuthor: Partial<Author> = {
    name: nameConfig,
    email: emailConfig,
    timestamp,
    timezoneOffset: new Date(timestamp * 1000).getTimezoneOffset(),
  }

  // Populate author object by using properties with this priority:
  // (1) provided author object
  // -> (2) author of provided commit object
  // -> (3) default author
  const normalizedAuthor = assignDefined(
    {} as Partial<Author>,
    defaultAuthor,
    commit ? commit.author : undefined,
    author
  ) as Author

  if (normalizedAuthor.name === undefined) {
    return undefined
  }

  return normalizedAuthor
}

