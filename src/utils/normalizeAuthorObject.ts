import { getConfigValue } from './configAccess.ts'
import { assignDefined } from './assignDefined.ts'
import type { FsClient } from "../models/FileSystem.ts"
import type { Author, CommitObject } from "../models/GitCommit.ts"
import type { Repository } from "../core-utils/Repository.ts"

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
 * @param {Repository} [args.repo] - Repository instance (optional, used for config access)
 *
 * @returns {Promise<void | {name: string, email: string, timestamp: number, timezoneOffset: number }>}
 */
export async function normalizeAuthorObject({
  fs,
  gitdir,
  author,
  commit,
  repo,
}: {
  fs: FsClient
  gitdir?: string
  author?: Partial<Author>
  commit?: CommitObject
  repo?: Repository
}): Promise<Author | undefined> {
  const timestamp = Math.floor(Date.now() / 1000)

  // Try to get config values - use direct getConfigValue to avoid repo.getGitdir() calls
  // that might throw NotFoundError before we can throw MissingNameError
  // This ensures MissingNameError is thrown first, not NotFoundError
  let nameConfig: string | undefined
  let emailConfig: string | undefined
  
  // CRITICAL: If gitdir is not provided, try to get it from repo
  // But only if repo is available and we can safely call getGitdir()
  let effectiveGitdir = gitdir
  if (!effectiveGitdir && repo) {
    try {
      effectiveGitdir = await repo.getGitdir()
    } catch {
      // If getGitdir() fails, we'll use empty string (which will fail, but that's expected)
    }
  }
  
  if (!effectiveGitdir) {
    // Return undefined - this will cause MissingNameError to be thrown
    return undefined
  }
  
  try {
    // Use direct getConfigValue to avoid repo.getConfig() -> repo.getGitdir() chain
    // that might throw NotFoundError
    nameConfig = (await getConfigValue(fs, effectiveGitdir, 'user.name')) as string | undefined
    emailConfig = ((await getConfigValue(fs, effectiveGitdir, 'user.email')) as string | undefined) || ''
  } catch (err) {
    // If getConfigValue fails, try repo.getConfig() as fallback
    // But only if repo is available and gitdir is valid
    if (repo && gitdir) {
      try {
        const config = await repo.getConfig()
        nameConfig = (await config.get('user.name')) as string | undefined
        emailConfig = ((await config.get('user.email')) as string | undefined) || ''
      } catch (err2) {
        // Both methods failed, nameConfig and emailConfig remain undefined
      }
    }
  }
  
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

