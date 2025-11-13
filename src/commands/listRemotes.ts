// @ts-check
import { ConfigAccess } from "../utils/configAccess.ts"
import type { FsClient } from "../models/FileSystem.ts"


/**
 * @param {object} args
 * @param {FsClient} args.fs
 * @param {string} args.gitdir
 *
 * @returns {Promise<Array<{remote: string, url: string}>>}
 */
export async function _listRemotes({ fs, gitdir }) {
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
