import { RevisionParser } from './RevisionParser.ts'
import { Repository } from "../core-utils/Repository.ts"

/**
 * Routes commands to their handlers
 */
export class CommandRouter {
  private _revisionParser: RevisionParser | null = null
  private readonly repo: Repository

  constructor(repo: Repository) {
    this.repo = repo
  }

  /**
   * Gets the revision parser (lazy-loaded)
   * @private
   */
  private async _getRevisionParser(): Promise<RevisionParser> {
    if (!this._revisionParser) {
      const gitdir = await this.repo.getGitdir()
      this._revisionParser = new RevisionParser(this.repo.fs, gitdir, this.repo.cache)
    }
    return this._revisionParser
  }

  /**
   * Dispatches a command to its handler
   */
  async dispatch(
    command: string,
    flags: Record<string, unknown>,
    positional: string[]
  ): Promise<unknown> {
    const handler = this._getHandler(command)
    if (!handler) {
      throw new Error(`Unknown command: ${command}`)
    }

    return handler.call(this, flags, positional)
  }

  /**
   * Gets the handler for a command
   * @private
   */
  private _getHandler(
    command: string
  ): ((flags: Record<string, unknown>, positional: string[]) => Promise<unknown>) | undefined {
    const handlers: Record<string, (flags: Record<string, unknown>, positional: string[]) => Promise<unknown>> = {
      init: this._handleInit,
      add: this._handleAdd,
      commit: this._handleCommit,
      status: this._handleStatus,
      log: this._handleLog,
      checkout: this._handleCheckout,
      branch: this._handleBranch,
      merge: this._handleMerge,
      pull: this._handlePull,
      push: this._handlePush,
      fetch: this._handleFetch,
      clone: this._handleClone,
      tag: this._handleTag,
      diff: this._handleDiff,
      show: this._handleShow,
      rm: this._handleRm,
      remote: this._handleRemote,
      sparseCheckout: this._handleSparseCheckout,
    }

    return handlers[command]
  }

  /**
   * Handler for init command
   * @private
   */
  private async _handleInit(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { init } = await import('../api/init.ts')
    const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '.'
    return init({
      fs: this.repo.fs,
      dir: positional[0] || cwd,
      bare: (flags.bare as boolean) || false,
      defaultBranch: (flags.defaultBranch as string) || 'master',
    })
  }

  /**
   * Handler for add command
   * @private
   */
  private async _handleAdd(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { add } = await import('../api/add.ts')
    const gitdir = await this.repo.getGitdir()
    return add({
      fs: this.repo.fs,
      dir: this.repo.dir,
      gitdir,
      filepath: positional.length > 0 ? positional : '.',
      force: (flags.force as boolean) || false,
      cache: this.repo.cache,
    })
  }

  /**
   * Handler for commit command
   * @private
   */
  private async _handleCommit(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { commit } = await import('../api/commit.ts')
    const gitdir = await this.repo.getGitdir()
    return commit({
      fs: this.repo.fs,
      dir: this.repo.dir,
      gitdir,
      message: (flags.message as string) || (flags.m as string) || positional.join(' '),
      author: flags.author as { name: string; email: string } | undefined,
      committer: flags.committer as { name: string; email: string } | undefined,
      cache: this.repo.cache,
    })
  }

  /**
   * Handler for status command
   * @private
   */
  private async _handleStatus(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { status } = await import('../api/status.ts')
    const gitdir = await this.repo.getGitdir()
    if (positional.length > 0) {
      // Status for specific file
      return status({
        fs: this.repo.fs,
        dir: this.repo.dir,
        gitdir,
        filepath: positional[0],
        cache: this.repo.cache,
      })
    } else {
      // Full status (would need statusMatrix or similar)
      throw new Error('Full status not yet implemented in CLI')
    }
  }

  /**
   * Handler for log command
   * @private
   */
  private async _handleLog(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { log } = await import('../api/log.ts')
    const gitdir = await this.repo.getGitdir()
    const ref = positional[0] || 'HEAD'
    return log({
      fs: this.repo.fs,
      dir: this.repo.dir,
      gitdir,
      ref,
      depth: (flags.depth as number) || (flags.n as number),
      filepath: flags.filepath as string | undefined,
      cache: this.repo.cache,
    })
  }

  /**
   * Handler for checkout command
   * @private
   */
  private async _handleCheckout(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { checkout } = await import('../api/checkout.ts')
    const gitdir = await this.repo.getGitdir()
    return checkout({
      fs: this.repo.fs,
      dir: this.repo.dir,
      gitdir,
      ref: positional[0],
      filepaths: positional.slice(1),
      force: (flags.force as boolean) || (flags.f as boolean) || false,
      cache: this.repo.cache,
    })
  }

  /**
   * Handler for branch command
   * @private
   */
  private async _handleBranch(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const gitdir = await this.repo.getGitdir()
    if (flags.delete || flags.d) {
      const { deleteBranch } = await import('../api/deleteBranch.ts')
      return deleteBranch({
        fs: this.repo.fs,
        dir: this.repo.dir,
        gitdir,
        ref: positional[0],
      })
    }
    const { branch } = await import('../api/branch.ts')
    return branch({
      fs: this.repo.fs,
      dir: this.repo.dir,
      gitdir,
      ref: positional[0],
      object: flags.object as string | undefined,
      checkout: flags.checkout as boolean | undefined,
      force: (flags.force as boolean) || (flags.f as boolean) || false,
    })
  }

  /**
   * Handler for merge command
   * @private
   */
  private async _handleMerge(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { merge } = await import('../api/merge.ts')
    const gitdir = await this.repo.getGitdir()
    return merge({
      fs: this.repo.fs,
      dir: this.repo.dir,
      gitdir,
      ref: positional[0],
      message: (flags.message as string) || (flags.m as string),
      noFF: (flags['no-ff'] as boolean) || (flags.noFf as boolean) || false,
      cache: this.repo.cache,
    })
  }

  /**
   * Handler for pull command
   * @private
   */
  private async _handlePull(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { pull } = await import('../api/pull.ts')
    const gitdir = await this.repo.getGitdir()
    return pull({
      fs: this.repo.fs,
      dir: this.repo.dir,
      gitdir,
      remote: (flags.remote as string) || 'origin',
      ref: positional[0],
      rebase: flags.rebase as boolean | undefined,
      cache: this.repo.cache,
    })
  }

  /**
   * Handler for push command
   * @private
   */
  private async _handlePush(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { push } = await import('../api/push.ts')
    const gitdir = await this.repo.getGitdir()
    return push({
      fs: this.repo.fs,
      dir: this.repo.dir,
      gitdir,
      remote: (flags.remote as string) || 'origin',
      ref: positional[0],
      force: (flags.force as boolean) || (flags.f as boolean) || false,
      cache: this.repo.cache,
    })
  }

  /**
   * Handler for fetch command
   * @private
   */
  private async _handleFetch(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { fetch } = await import('../api/fetch.ts')
    const gitdir = await this.repo.getGitdir()
    return fetch({
      fs: this.repo.fs,
      dir: this.repo.dir,
      gitdir,
      remote: (flags.remote as string) || 'origin',
      ref: positional[0],
      cache: this.repo.cache,
    })
  }

  /**
   * Handler for clone command
   * @private
   */
  private async _handleClone(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { clone } = await import('../api/clone.ts')
    const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '.'
    return clone({
      fs: this.repo.fs,
      dir: positional[1] || cwd,
      url: positional[0],
      ref: flags.ref as string | undefined,
      depth: flags.depth as number | undefined,
      singleBranch: flags.singleBranch as boolean | undefined,
      cache: this.repo.cache,
    })
  }

  /**
   * Handler for tag command
   * @private
   */
  private async _handleTag(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { tag } = await import('../api/tag.ts')
    const gitdir = await this.repo.getGitdir()
    return tag({
      fs: this.repo.fs,
      dir: this.repo.dir,
      gitdir,
      ref: positional[0],
      object: flags.object as string | undefined,
      force: (flags.force as boolean) || (flags.f as boolean) || false,
    })
  }

  /**
   * Handler for diff command
   * @private
   */
  private async _handleDiff(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { diff } = await import('../api/diff.ts')
    const gitdir = await this.repo.getGitdir()
    return diff({
      fs: this.repo.fs,
      dir: this.repo.dir,
      gitdir,
      refA: positional[0],
      refB: positional[1],
      filepath: flags.filepath as string | undefined,
      cache: this.repo.cache,
    })
  }

  /**
   * Handler for show command
   * @private
   */
  private async _handleShow(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { show } = await import('../api/show.ts')
    const gitdir = await this.repo.getGitdir()
    return show({
      fs: this.repo.fs,
      dir: this.repo.dir,
      gitdir,
      ref: positional[0] || 'HEAD',
      filepath: flags.filepath as string | undefined,
      cache: this.repo.cache,
    })
  }

  /**
   * Handler for rm command
   * @private
   */
  private async _handleRm(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { remove } = await import('../api/remove.ts')
    const gitdir = await this.repo.getGitdir()
    return remove({
      fs: this.repo.fs,
      dir: this.repo.dir,
      gitdir,
      filepath: positional,
      cached: flags.cached as boolean | undefined,
      cache: this.repo.cache,
    })
  }

  /**
   * Handler for remote command
   * @private
   */
  private async _handleRemote(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const gitdir = await this.repo.getGitdir()
    if (flags.add) {
      const { addRemote } = await import('../api/addRemote.ts')
      return addRemote({
        fs: this.repo.fs,
        dir: this.repo.dir,
        gitdir,
        remote: positional[0],
        url: positional[1],
        force: (flags.force as boolean) || (flags.f as boolean) || false,
      })
    } else if (flags.remove || flags.rm) {
      const { deleteRemote } = await import('../api/deleteRemote.ts')
      return deleteRemote({
        fs: this.repo.fs,
        dir: this.repo.dir,
        gitdir,
        remote: positional[0],
      })
    } else {
      const { listRemotes } = await import('../api/listRemotes.ts')
      return listRemotes({
        fs: this.repo.fs,
        dir: this.repo.dir,
        gitdir,
      })
    }
  }

  /**
   * Handler for sparse-checkout command
   * @private
   */
  private async _handleSparseCheckout(flags: Record<string, unknown>, positional: string[]): Promise<unknown> {
    const { sparseCheckout } = await import('../api/sparseCheckout.ts')
    const gitdir = await this.repo.getGitdir()
    if (flags.init) {
      return sparseCheckout({
        fs: this.repo.fs,
        dir: this.repo.dir,
        gitdir,
        init: true,
        cone: flags.cone as boolean | undefined,
        cache: this.repo.cache,
      })
    } else if (flags.set) {
      return sparseCheckout({
        fs: this.repo.fs,
        dir: this.repo.dir,
        gitdir,
        set: positional,
        cone: flags.cone as boolean | undefined,
        cache: this.repo.cache,
      })
    } else if (flags.list) {
      return sparseCheckout({
        fs: this.repo.fs,
        dir: this.repo.dir,
        gitdir,
        list: true,
      })
    }
    throw new Error('sparse-checkout requires one of: --init, --set, or --list')
  }
}
