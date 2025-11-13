import { ConfigAccess } from "../utils/configAccess.ts"
import type { FsClient } from "../models/FileSystem.ts"

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

