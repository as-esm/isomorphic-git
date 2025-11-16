import cleanGitRef from 'clean-git-ref'

import { AlreadyExistsError } from '../errors/AlreadyExistsError.ts'
import { InvalidRefNameError } from '../errors/InvalidRefNameError.ts'
import { ConfigAccess } from "../utils/configAccess.ts"
import validRef from "../utils/isValidRef.ts"
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
  fs: _fs,
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
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir!)
    assertParameter('remote', remote)
    assertParameter('url', url)

    const fs = normalizeFs(_fs)
    if (!validRef(remote, true)) {
      throw new InvalidRefNameError(remote, cleanGitRef.clean(remote))
    }
    
    // Use ConfigAccess for config operations
    const configAccess = new ConfigAccess(fs, gitdir!)
    
    if (!force) {
      // Check that setting it wouldn't overwrite.
      const remoteNames = await configAccess.getSubsections('remote')
      if (remoteNames.includes(remote)) {
        // Throw an error if it would overwrite an existing remote,
        // but not if it's simply setting the same value again.
        const existingUrl = await configAccess.getConfigValue(`remote.${remote}.url`)
        if (url !== existingUrl) {
          throw new AlreadyExistsError('remote', remote)
        }
      }
    }
    await configAccess.setConfigValue(`remote.${remote}.url`, url, 'local')
    await configAccess.setConfigValue(
      `remote.${remote}.fetch`,
      `+refs/heads/*:refs/remotes/${remote}/*`,
      'local'
    )
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.addRemote'
    throw err
  }
}

