import { getConfigValue } from './configAccess.ts'
import { assignDefined } from './assignDefined.ts'
import type { FsClient } from "../models/FileSystem.ts"
import type { Author, CommitObject } from "../models/GitCommit.ts"
import type { Repository } from "../core-utils/Repository.ts"

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
 * @param {Repository} [args.repo] - Repository instance (optional, used for config access)
 *
 * @returns {Promise<void | {name: string, email: string, timestamp: number, timezoneOffset: number }>}
 */
export async function normalizeCommitterObject({
  fs,
  gitdir,
  author,
  committer,
  commit,
  repo,
}: {
  fs: FsClient
  gitdir?: string
  author?: Partial<Author>
  committer?: Partial<Author>
  commit?: CommitObject
  repo?: Repository
}): Promise<Author | undefined> {
  const timestamp = Math.floor(Date.now() / 1000)

  // Try to use repo's config service if available
  let nameConfig: string | undefined
  let emailConfig: string | undefined
  if (repo) {
    try {
      const config = await repo.getConfig()
      nameConfig = (await config.get('user.name')) as string | undefined
      emailConfig = ((await config.get('user.email')) as string | undefined) || ''
    } catch {
      // Fall back to direct config access if repo config fails
      nameConfig = (await getConfigValue(fs, gitdir || '', 'user.name')) as string | undefined
      emailConfig = ((await getConfigValue(fs, gitdir || '', 'user.email')) as string | undefined) || ''
    }
  } else {
    nameConfig = (await getConfigValue(fs, gitdir || '', 'user.name')) as string | undefined
    emailConfig = ((await getConfigValue(fs, gitdir || '', 'user.email')) as string | undefined) || '' // committer.email is allowed to be empty string
  }
  
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

