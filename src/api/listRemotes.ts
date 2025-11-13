import { _listRemotes } from '../commands/listRemotes.js'
import { normalizeFs } from '../utils/normalizeFs.js'
import { assertParameter } from '../utils/assertParameter.js'
import { join } from '../utils/join.js'
import type { FsClient } from '../models/FileSystem.js'

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
  fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
}): Promise<Array<{ remote: string; url: string }>> {
  try {
    assertParameter('fs', fs)
    if (!gitdir) {
      throw new Error('gitdir is required')
    }
    assertParameter('gitdir', gitdir)

    const result = await _listRemotes({
      fs: normalizeFs(fs),
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

