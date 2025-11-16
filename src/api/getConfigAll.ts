import { Repository } from "../core-utils/Repository.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { withErrorCaller } from "../utils/errorHandler.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Read a multi-valued entry from the git config files.
 *
 * *Caveats:*
 * - Currently only the local `$GIT_DIR/config` file can be read or written. However support for the global `~/.gitconfig` and system `$(prefix)/etc/gitconfig` will be added in the future.
 * - The current parser does not support the more exotic features of the git-config file format such as `[include]` and `[includeIf]`.
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.path - The key of the git config entry
 *
 * @returns {Promise<Array<any>>} Resolves with the config value
 *
 */
export const getConfigAll = withErrorCaller(
  async ({
    fs,
    dir,
    gitdir = dir ? join(dir, '.git') : undefined,
    path,
    cache = {},
  }: {
    fs: FsClient
    dir?: string
    gitdir?: string
    path: string
    cache?: Record<string, unknown>
  }): Promise<Array<any>> => {
    assertParameter('fs', fs)
    if (!gitdir) {
      throw new Error('gitdir is required')
    }
    assertParameter('gitdir', gitdir)
    assertParameter('path', path)

    // CRITICAL: Use Repository to ensure state consistency
    // This ensures that setConfig() and getConfigAll() use the same UnifiedConfigService instance
    const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
    const config = await repo.getConfig()
    const values = await config.getAll(path)
    return values.map(v => v.value)
  },
  'git.getConfigAll'
)

