import { ConfigAccess } from "../utils/configAccess.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * List remotes
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 *
 * @returns {Promise<Array<{remote: string, url: string}>>} Resolves successfully with an array of `{remote, url}` objects
 *
 * @example
 * let remotes = await git.listRemotes({ fs, dir: '/tutorial' })
 * console.log(remotes)
 *
 */
export async function listRemotes({
  fs: _fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
}): Promise<Array<{ remote: string; url: string }>> {
  try {
    assertParameter('fs', _fs)
    if (!gitdir) {
      throw new Error('gitdir is required')
    }
    assertParameter('gitdir', gitdir)

    const fs = normalizeFs(_fs)
    const result = await _listRemotes({
      fs,
      gitdir,
    })
    return result.map(({ remote, url }) => ({
      remote: remote || '',
      url: String(url || ''),
    }))
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.listRemotes'
    throw err
  }
}

/**
 * Internal listRemotes implementation
 * @internal - Exported for use by other commands
 */
export async function _listRemotes({
  fs,
  gitdir,
}: {
  fs: FsClient
  gitdir: string
}): Promise<Array<{ remote: string; url: string | undefined }>> {
  const configAccess = new ConfigAccess(fs, gitdir)
  const remoteNames = await configAccess.getSubsections('remote')
  const remotes = await Promise.all(
    remoteNames.map(async remote => {
      const url = await configAccess.getConfigValue(`remote.${remote}.url`)
      return { remote, url }
    })
  )
  return remotes
}
