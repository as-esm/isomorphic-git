import { Repository } from "../core-utils/Repository.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Gets a config value from the repository
 * CRITICAL: Uses Repository to ensure state consistency
 */
export async function _getConfig({
  fs,
  gitdir,
  path,
  cache = {},
}: {
  fs: FsClient
  gitdir: string
  path: string
  cache?: Record<string, unknown>
}): Promise<unknown> {
  const repo = await Repository.open({ fs, gitdir, cache, autoDetectConfig: true })
  const config = await repo.getConfig()
  return config.get(path)
}

