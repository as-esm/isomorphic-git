import { parse as parseConfig, serialize as serializeConfig } from "../core-utils/ConfigParser.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * @param {Object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {string} args.remote
 *
 * @returns {Promise<void>}
 */
export async function _deleteRemote({ fs, gitdir, remote }: { fs: FsClient; gitdir: string; remote: string }): Promise<void> {
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

