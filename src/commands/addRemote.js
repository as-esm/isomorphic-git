// @ts-check
import '../typedefs.js'

import cleanGitRef from 'clean-git-ref'

import { AlreadyExistsError } from '../errors/AlreadyExistsError.js'
import { InvalidRefNameError } from '../errors/InvalidRefNameError.js'
import { ConfigAccess } from '../utils/configAccess.js'
import validRef from '../utils/isValidRef.js'
import { join } from '../utils/join.js'

/**
 * @param {object} args
 * @param {import('../types.js').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {string} args.remote
 * @param {string} args.url
 * @param {boolean} args.force
 *
 * @returns {Promise<void>}
 *
 */
export async function _addRemote({ fs, gitdir, remote, url, force }) {
  if (!validRef(remote, true)) {
    throw new InvalidRefNameError(remote, cleanGitRef.clean(remote))
  }
  
  // Use ConfigAccess for config operations
  const configAccess = new ConfigAccess(fs, gitdir)
  
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
}
