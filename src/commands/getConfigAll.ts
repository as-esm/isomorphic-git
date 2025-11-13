import { ConfigAccess } from '../utils/configAccess.js'
import type { FsClient } from '../models/FileSystem.js'

/**
 * Gets all config values for a path
 */
export async function _getConfigAll({
  fs,
  gitdir,
  path,
}: {
  fs: FsClient
  gitdir: string
  path: string
}): Promise<unknown[]> {
  const configAccess = new ConfigAccess(fs, gitdir)
  const values = await configAccess.getAllConfigValues(path)
  return values.map(v => v.value)
}

