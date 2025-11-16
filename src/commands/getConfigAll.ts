import { Repository } from "../core-utils/Repository.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Gets all config values for a path
 * CRITICAL: Uses Repository to ensure state consistency
 */
export async function _getConfigAll({
  fs,
  gitdir,
  path,
  cache = {},
}: {
  fs: FsClient
  gitdir: string
  path: string
  cache?: Record<string, unknown>
}): Promise<unknown[]> {
  const repo = await Repository.open({ fs, gitdir, cache, autoDetectConfig: true })
  const config = await repo.getConfig()
  const values = await config.getAll(path)
  return values.map(v => v.value)
}

