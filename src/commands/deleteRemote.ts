import { parse as parseConfig, serialize as serializeConfig } from "../core-utils/ConfigParser.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Removes the local config entry for a given remote
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.remote - The name of the remote to delete
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.deleteRemote({ fs, dir: '/tutorial', remote: 'upstream' })
 * console.log('done')
 *
 */
export async function deleteRemote({
  fs: _fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  remote,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  remote: string
}): Promise<void> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir!)
    assertParameter('remote', remote)

    const fs = normalizeFs(_fs)
    let configBuffer = Buffer.alloc(0)
    try {
      configBuffer = await fs.read(join(gitdir!, 'config'))
    } catch (err) {
      // Config doesn't exist
      return
    }
    const config = parseConfig(configBuffer)
    config.deleteSection('remote', remote)
    const updatedConfig = serializeConfig(config)
    await fs.write(join(gitdir!, 'config'), updatedConfig)
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.deleteRemote'
    throw err
  }
}

