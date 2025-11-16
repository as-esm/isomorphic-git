import { assignDefined } from './assignDefined.ts'
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
 * @param {Repository} args.repo - Repository instance (required for config access)
 * @param {Object} [args.author] - The author object.
 * @param {Object} [args.committer] - The committer object.
 * @param {CommitObject} [args.commit] - A commit object.
 *
 * @returns {Promise<void | {name: string, email: string, timestamp: number, timezoneOffset: number }>}
 */
export async function normalizeCommitterObject({
  repo,
  author,
  committer,
  commit,
}: {
  repo: Repository
  author?: Partial<Author>
  committer?: Partial<Author>
  commit?: CommitObject
}): Promise<Author | undefined> {
  // CRITICAL: Use the Repository's config service to ensure state consistency
  // This ensures that setConfig() and getCommitter() use the same UnifiedConfigService instance
  const config = await repo.getConfig()
  const nameConfig = (await config.get('user.name')) as string | undefined
  const emailConfig = ((await config.get('user.email')) as string | undefined) || '' // committer.email is allowed to be empty string
  
  // CRITICAL: Only use current timestamp if no timestamp is provided in committer, author, or commit
  // This ensures tests that provide specific timestamps get those exact timestamps
  // Priority: committer.timestamp > author.timestamp > commit.committer.timestamp > current time
  const providedTimestamp = committer?.timestamp ?? author?.timestamp ?? commit?.committer?.timestamp
  const timestamp = providedTimestamp ?? Math.floor(Date.now() / 1000)
  
  // CRITICAL: Only use current timezoneOffset if no timezoneOffset is provided
  // Priority: committer.timezoneOffset > author.timezoneOffset > commit.committer.timezoneOffset > current timezone
  const providedTimezoneOffset = committer?.timezoneOffset ?? author?.timezoneOffset ?? commit?.committer?.timezoneOffset
  const timezoneOffset = providedTimezoneOffset !== undefined 
    ? providedTimezoneOffset 
    : new Date(timestamp * 1000).getTimezoneOffset()
  
  const defaultCommitter: Partial<Author> = {
    name: nameConfig,
    email: emailConfig,
    timestamp,
    timezoneOffset,
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

