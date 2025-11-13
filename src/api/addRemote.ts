import { _addRemote } from "../commands/addRemote.js"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Add or update a remote
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.remote - The name of the remote
 * @param {string} args.url - The URL of the remote
 * @param {boolean} [args.force = false] - Instead of throwing an error if a remote named `remote` already exists, overwrite the existing remote.
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.addRemote({
 *   fs,
 *   dir: '/tutorial',
 *   remote: 'upstream',
 *   url: 'https://github.com/isomorphic-git/isomorphic-git'
 * })
 * console.log('done')
 *
 */
export async function addRemote({
  fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  remote,
  url,
  force = false,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  remote: string
  url: string
  force?: boolean
}): Promise<void> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir!)
    assertParameter('remote', remote)
    assertParameter('url', url)
    return await _addRemote({
      fs: normalizeFs(fs) as any,
      gitdir: gitdir!,
      remote,
      url,
      force,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.addRemote'
    throw err
  }
}

