import { getConfigValue } from '../utils/configAccess.js'
import type { FsClient } from '../models/FileSystem.js'

/**
 * Gets a config value from the repository
 */
export async function _getConfig({
  fs,
  gitdir,
  path,
}: {
  fs: FsClient
  gitdir: string
  path: string
}): Promise<unknown> {
  return getConfigValue(fs, gitdir, path)
}

