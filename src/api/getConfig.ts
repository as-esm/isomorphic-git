import { _getConfig } from "../commands/getConfig.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { withErrorCaller } from "../utils/errorHandler.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Read an entry from the git config files.
 *
 * *Caveats:*
 * - Currently only the local `$GIT_DIR/config` file can be read or written. However support for the global `~/.gitconfig` and system `$(prefix)/etc/gitconfig` will be added in the future.
 * - The current parser does not support the more exotic features of the git-config file format such as `[include]` and `[includeIf]`.
 */
export const getConfig = withErrorCaller(
  async ({
    fs,
    dir,
    gitdir = dir ? join(dir, '.git') : undefined,
    path,
  }: {
    fs: FsClient
    dir?: string
    gitdir?: string
    path: string
  }): Promise<unknown> => {
    assertParameter('fs', fs)
    if (!gitdir) {
      throw new Error('gitdir is required')
    }
    assertParameter('gitdir', gitdir)
    assertParameter('path', path)

    return await _getConfig({
      fs,
      gitdir,
      path,
    })
  },
  'git.getConfig'
)

