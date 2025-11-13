// @ts-check
import { parse as parseConfig, serialize as serializeConfig } from "../core-utils/ConfigParser.ts"
import { join } from "../utils/join.ts"

/**
 * @param {Object} args
 * @param {import('../types.js').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {string} args.remote
 *
 * @returns {Promise<void>}
 */
export async function _deleteRemote({ fs, gitdir, remote }) {
  let configBuffer = Buffer.alloc(0)
  try {
    configBuffer = await fs.read(join(gitdir, 'config'))
  } catch (err) {
    // Config doesn't exist
    return
  }
  const config = parseConfig(configBuffer)
  config.deleteSection('remote', remote)
  const updatedConfig = serializeConfig(config)
  await fs.write(join(gitdir, 'config'), updatedConfig)
}
