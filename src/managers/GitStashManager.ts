import { _readCommit } from "../commands/readCommit.ts"
import { _writeCommit } from '../commands/writeCommit.ts'
import { InvalidRefNameError } from '../errors/InvalidRefNameError.ts'
import { MissingNameError } from '../errors/MissingNameError.ts'
import { GitRefStash } from "../models/GitRefStash.ts"
import { join } from "../utils/join.ts"
import { normalizeAuthorObject } from "../utils/normalizeAuthorObject.ts"
import { acquireLock } from "../utils/walkerToTreeEntryMap.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { Author } from "../models/GitCommit.ts"
import type { Repository } from "../core-utils/Repository.ts"

// GitRefManager import removed - using src/git/refs/ functions instead

export class GitStashManager {
  fs: FsClient
  dir: string
  gitdir: string
  _author: Author | null = null
  repo: Repository | null = null

  /**
   * Creates an instance of GitStashManager.
   */
  constructor({
    fs,
    dir,
    gitdir = join(dir, '.git'),
    repo,
  }: {
    fs: FsClient
    dir: string
    gitdir?: string
    repo?: Repository
  }) {
    this.fs = fs
    this.dir = dir
    this.gitdir = gitdir
    this._author = null
    this.repo = repo || null
  }

  /**
   * Gets the reference name for the stash.
   */
  static get refStash(): string {
    return 'refs/stash'
  }

  /**
   * Gets the reference name for the stash reflogs.
   */
  static get refLogsStash(): string {
    return 'logs/refs/stash'
  }

  /**
   * Gets the file path for the stash reference.
   */
  get refStashPath(): string {
    return join(this.gitdir, GitStashManager.refStash)
  }

  /**
   * Gets the file path for the stash reflogs.
   */
  get refLogsStashPath(): string {
    return join(this.gitdir, GitStashManager.refLogsStash)
  }

  /**
   * Retrieves the author information for the stash.
   * Uses Repository's config service if available, otherwise falls back to direct config access.
   */
  async getAuthor(): Promise<Author> {
    if (!this._author) {
      let author: Author | undefined
      
      // CRITICAL: Use normalizeAuthorObject directly instead of repo.getConfig()
      // This avoids calling repo.getGitdir() which might throw NotFoundError
      // We want MissingNameError to be thrown, not NotFoundError
      // normalizeAuthorObject will handle repo.getConfig() internally if repo is provided
      try {
        author = await normalizeAuthorObject({
          fs: this.fs,
          gitdir: this.gitdir,
          author: {},
          repo: this.repo, // Pass repo so normalizeAuthorObject can use it if available
        })
      } catch (err) {
        throw err
      }
      
      if (!author) {
        throw new MissingNameError('author')
      }
      this._author = author
    }
    return this._author
  }

  /**
   * Gets the SHA of a stash entry by its index.
   */
  async getStashSHA(
    refIdx: number,
    stashEntries?: string[]
  ): Promise<string | null> {
    const normalizedFs = normalizeFs(this.fs)
    if (!(await normalizedFs.exists(this.refStashPath))) {
      return null
    }

    const entries =
      stashEntries || (await this.readStashReflogs({ parsed: false }))
    if (refIdx >= entries.length) {
      return null
    }
    const entry = entries[refIdx]
    if (typeof entry === 'string') {
      return entry.split(' ')[1]
    }
    return null
  }

  /**
   * Writes a stash commit to the repository.
   */
  async writeStashCommit({
    message,
    tree,
    parent,
  }: {
    message: string
    tree: string
    parent: string[]
  }): Promise<string> {
    return _writeCommit({
      fs: this.fs,
      gitdir: this.gitdir,
      commit: {
        message,
        tree,
        parent,
        author: await this.getAuthor(),
        committer: await this.getAuthor(),
      },
    })
  }

  /**
   * Reads a stash commit by its index.
   */
  async readStashCommit(refIdx: number): Promise<{
    oid: string
    commit: {
      message: string
      tree: string
      parent: string[]
      author: Author
      committer: Author
      gpgsig?: string
    }
  } | Record<string, never>> {
    const stashEntries = await this.readStashReflogs({ parsed: false })
    if (refIdx !== 0) {
      // non-default case, throw exceptions if not valid
      if (refIdx < 0 || refIdx > stashEntries.length - 1) {
        throw new InvalidRefNameError(
          `stash@${refIdx}`,
          'number that is in range of [0, num of stash pushed]'
        )
      }
    }

    const stashSHA = await this.getStashSHA(refIdx, stashEntries as string[])
    if (!stashSHA) {
      return {} // no stash found
    }

    // get the stash commit object
    return _readCommit({
      fs: this.fs,
      cache: {},
      gitdir: this.gitdir,
      oid: stashSHA,
    })
  }

  /**
   * Writes a stash reference to the repository.
   */
  async writeStashRef(stashCommit: string): Promise<void> {
    // Use direct writeRef() for consistency
    const { writeRef } = await import('../git/refs/writeRef.ts')
    return writeRef({
      fs: this.fs,
      gitdir: this.gitdir,
      ref: GitStashManager.refStash,
      value: stashCommit,
    })
  }

  /**
   * Writes a reflog entry for a stash commit.
   */
  async writeStashReflogEntry({
    stashCommit,
    message,
  }: {
    stashCommit: string
    message: string
  }): Promise<void> {
    const author = await this.getAuthor()
    const entry = GitRefStash.createStashReflogEntry(
      author,
      stashCommit,
      message
    )
    const filepath = this.refLogsStashPath
    const normalizedFs = normalizeFs(this.fs)

    await acquireLock({ filepath, entry }, async () => {
      const appendTo = (await normalizedFs.exists(filepath))
        ? await normalizedFs.read(filepath, { encoding: 'utf8' })
        : ''
      if (typeof appendTo === 'string') {
        await normalizedFs.write(filepath, appendTo + entry, 'utf8')
      }
    })
  }

  /**
   * Reads the stash reflogs.
   */
  async readStashReflogs({
    parsed = false,
  }: {
    parsed?: boolean
  }): Promise<string[] | Array<Record<string, unknown>>> {
    const normalizedFs = normalizeFs(this.fs)
    if (!(await normalizedFs.exists(this.refLogsStashPath))) {
      return []
    }

    const reflogString = await normalizedFs.read(this.refLogsStashPath, { encoding: 'utf8' })
    if (typeof reflogString !== 'string') {
      return []
    }

    // If the reflog string is empty or only whitespace, return empty array
    if (!reflogString.trim()) {
      return []
    }

    return GitRefStash.getStashReflogEntry(reflogString, parsed)
  }
}

