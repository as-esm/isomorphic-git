// @ts-check
import { _currentBranch } from '../commands/currentBranch.js'
import { NotFoundError } from '../errors/NotFoundError.js'
import { RefManager } from '../core-utils/refs/RefManager.js'
import { parse as parseConfig, serialize as serializeConfig } from '../core-utils/ConfigParser.js'
import { abbreviateRef } from '../utils/abbreviateRef.js'
import { join } from '../utils/join.js'

/**
 * @param {Object} args
 * @param {import('../types.js').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {string} args.ref
 *
 * @returns {Promise<void>}
 */
export async function _deleteBranch({ fs, gitdir, ref }) {
  ref = ref.startsWith('refs/heads/') ? ref : `refs/heads/${ref}`
  try {
    await RefManager.resolve({ fs, gitdir, ref })
  } catch (e) {
    throw new NotFoundError(ref)
  }

  const currentRef = await _currentBranch({ fs, gitdir, fullname: true })
  if (ref === currentRef) {
    // detach HEAD
    const value = await RefManager.resolve({ fs, gitdir, ref })
    await RefManager.writeRef({ fs, gitdir, ref: 'HEAD', value })
  }

  // Delete a specified branch
  await RefManager.deleteRef({ fs, gitdir, ref })

  // Delete branch config entries
  const abbrevRef = abbreviateRef(ref)
  let configBuffer = Buffer.alloc(0)
  try {
    configBuffer = await fs.read(join(gitdir, 'config'))
  } catch (err) {
    // Config doesn't exist
    return
  }
  const config = parseConfig(configBuffer)
  config.deleteSection('branch', abbrevRef)
  const updatedConfig = serializeConfig(config)
  await fs.write(join(gitdir, 'config'), updatedConfig)
}
