import { GitConfig } from '../models/GitConfig.js'
import { normalizeFs } from '../utils/normalizeFs.js'
import type { FsClient } from '../models/FileSystem.js'

/**
 * Manages access to the Git configuration file, providing methods to read and save configurations.
 */
export class GitConfigManager {
  /**
   * Reads the Git configuration file from the specified `.git` directory.
   */
  static async get({
    fs,
    gitdir,
  }: {
    fs: FsClient
    gitdir: string
  }): Promise<GitConfig> {
    // We can improve efficiency later if needed.
    // TODO: read from full list of git config files
    const normalizedFs = normalizeFs(fs)
    const text = await normalizedFs.read(`${gitdir}/config`, { encoding: 'utf8' })
    if (typeof text !== 'string') {
      throw new Error('Failed to read config file')
    }
    return GitConfig.from(text)
  }

  /**
   * Saves the provided Git configuration to the specified `.git` directory.
   */
  static async save({
    fs,
    gitdir,
    config,
  }: {
    fs: FsClient
    gitdir: string
    config: GitConfig
  }): Promise<void> {
    // We can improve efficiency later if needed.
    // TODO: handle saving to the correct global/user/repo location
    const normalizedFs = normalizeFs(fs)
    await normalizedFs.write(`${gitdir}/config`, config.toString(), {
      encoding: 'utf8',
    })
  }
}

