import { Repository } from "../core-utils/Repository.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { withErrorCaller } from "../utils/errorHandler.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Write an entry to the git config files.
 *
 * *Caveats:*
 * - Currently only the local `$GIT_DIR/config` file can be read or written. However support for the global `~/.gitconfig` and system `$(prefix)/etc/gitconfig` will be added in the future.
 * - The current parser does not support the more exotic features of the git-config file format such as `[include]` and `[includeIf]`.
 */
export const setConfig = withErrorCaller(
  async ({
    fs: _fs,
    dir,
    gitdir = join(dir ? dir : "", '.git'),
    path,
    value,
    append = false,
    cache = {},
  }: {
    fs: FsClient
    dir?: string
    gitdir?: string
    path: string
    value: string | boolean | number | undefined
    append?: boolean
    cache?: Record<string, unknown>
  }): Promise<void> => {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('path', path)
    // assertParameter('value', value) // We actually allow 'undefined' as a value to unset/delete

    // CRITICAL: Use Repository to ensure state consistency
    // This ensures that setConfig() and getConfig() use the same UnifiedConfigService instance
    const repo = await Repository.open({ fs: _fs, dir, gitdir, cache, autoDetectConfig: true })
    const config = await repo.getConfig()
    
    if (append) {
      await config.append(path, value, 'local')
    } else {
      await config.set(path, value, 'local')
    }
  },
  'git.setConfig'
)

