import { join } from "../utils/join.ts"
import {
  refStash,
  refLogsStash,
  getStashRefPath,
  getStashReflogsPath,
  getStashAuthor,
  getStashSHA,
  writeStashCommit,
  readStashCommit,
  writeStashRef,
  writeStashReflogEntry,
  readStashReflogs,
} from "../git/refs/stash.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { Author } from "../models/GitCommit.ts"
import type { Repository } from "../core-utils/Repository.ts"

/**
 * @deprecated This class is deprecated in favor of direct functions in `src/git/refs/stash.ts`.
 * Use the following functions instead:
 * - `getStashAuthor()` - Get author for stash operations
 * - `getStashSHA()` - Get stash SHA by index
 * - `writeStashCommit()` - Write stash commit
 * - `readStashCommit()` - Read stash commit
 * - `writeStashRef()` - Write stash ref
 * - `writeStashReflogEntry()` - Write stash reflog entry
 * - `readStashReflogs()` - Read stash reflogs
 * 
 * This class is maintained for backward compatibility and will be removed in a future version.
 */
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
   * @deprecated Use `refStash` from `src/git/refs/stash.ts` instead
   */
  static get refStash(): string {
    return refStash
  }

  /**
   * Gets the reference name for the stash reflogs.
   * @deprecated Use `refLogsStash` from `src/git/refs/stash.ts` instead
   */
  static get refLogsStash(): string {
    return refLogsStash
  }

  /**
   * Gets the file path for the stash reference.
   * @deprecated Use `getStashRefPath()` from `src/git/refs/stash.ts` instead
   */
  get refStashPath(): string {
    return getStashRefPath(this.gitdir)
  }

  /**
   * Gets the file path for the stash reflogs.
   * @deprecated Use `getStashReflogsPath()` from `src/git/refs/stash.ts` instead
   */
  get refLogsStashPath(): string {
    return getStashReflogsPath(this.gitdir)
  }

  /**
   * Retrieves the author information for the stash.
   * Uses Repository's config service to ensure state consistency.
   * @deprecated Use `getStashAuthor()` from `src/git/refs/stash.ts` instead
   */
  async getAuthor(): Promise<Author> {
    if (!this._author) {
      if (!this.repo) {
        throw new Error('Repository instance is required for GitStashManager')
      }
      this._author = await getStashAuthor({ fs: this.fs, gitdir: this.gitdir, repo: this.repo })
    }
    return this._author
  }

  /**
   * Gets the SHA of a stash entry by its index.
   * @deprecated Use `getStashSHA()` from `src/git/refs/stash.ts` instead
   */
  async getStashSHA(
    refIdx: number,
    stashEntries?: string[]
  ): Promise<string | null> {
    return getStashSHA({
      fs: this.fs,
      gitdir: this.gitdir,
      refIdx,
      stashEntries,
    })
  }

  /**
   * Writes a stash commit to the repository.
   * @deprecated Use `writeStashCommit()` from `src/git/refs/stash.ts` instead
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
    if (!this.repo) {
      throw new Error('Repository instance is required for GitStashManager.writeStashCommit')
    }
    return writeStashCommit({
      fs: this.fs,
      gitdir: this.gitdir,
      message,
      tree,
      parent,
      repo: this.repo,
    })
  }

  /**
   * Reads a stash commit by its index.
   * @deprecated Use `readStashCommit()` from `src/git/refs/stash.ts` instead
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
    return readStashCommit({
      fs: this.fs,
      gitdir: this.gitdir,
      refIdx,
    })
  }

  /**
   * Writes a stash reference to the repository.
   * @deprecated Use `writeStashRef()` from `src/git/refs/stash.ts` instead
   */
  async writeStashRef(stashCommit: string): Promise<void> {
    return writeStashRef({
      fs: this.fs,
      gitdir: this.gitdir,
      stashCommit,
    })
  }

  /**
   * Writes a reflog entry for a stash commit.
   * @deprecated Use `writeStashReflogEntry()` from `src/git/refs/stash.ts` instead
   */
  async writeStashReflogEntry({
    stashCommit,
    message,
  }: {
    stashCommit: string
    message: string
  }): Promise<void> {
    if (!this.repo) {
      throw new Error('Repository instance is required for GitStashManager.writeStashReflogEntry')
    }
    return writeStashReflogEntry({
      fs: this.fs,
      gitdir: this.gitdir,
      stashCommit,
      message,
      repo: this.repo,
    })
  }

  /**
   * Reads the stash reflogs.
   * @deprecated Use `readStashReflogs()` from `src/git/refs/stash.ts` instead
   */
  async readStashReflogs({
    parsed = false,
  }: {
    parsed?: boolean
  }): Promise<string[] | Array<Record<string, unknown>>> {
    return readStashReflogs({
      fs: this.fs,
      gitdir: this.gitdir,
      parsed,
    })
  }
}

