/**
 * @deprecated Use functions from '../git/config.ts' instead
 * This class is kept for backward compatibility and will be removed in a future version.
 * 
 * For reading config: use `readConfig()` from '../git/config.ts'
 * For writing config: use `writeConfig()` from '../git/config.ts'
 * For getting/setting values: use `getConfig()`, `setConfig()`, `getConfigAll()` from '../git/config.ts'
 */
import { GitConfig } from "../models/GitConfig.ts"
import { readConfig, writeConfig } from "../git/config.ts"
import { serialize as serializeConfig, parse as parseConfig } from "../core-utils/ConfigParser.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * @deprecated Use functions from '../git/config.ts' instead
 * Manages access to the Git configuration file, providing methods to read and save configurations.
 */
export class GitConfigManager {
  /**
   * @deprecated Use `readConfig()` from '../git/config.ts' instead
   * Reads the Git configuration file from the specified `.git` directory.
   */
  static async get({
    fs,
    gitdir,
  }: {
    fs: FsClient
    gitdir: string
  }): Promise<GitConfig> {
    // Delegate to the new implementation
    const normalizedFs = normalizeFs(fs)
    // Check if config file exists (for backward compatibility - old behavior threw error)
    const configPath = `${gitdir}/config`
    if (!(await normalizedFs.exists(configPath))) {
      throw new Error('Failed to read config file')
    }
    const config = await readConfig({ fs: normalizedFs, gitdir })
    // Convert ConfigObject to GitConfig
    // serializeConfig returns a Buffer, but GitConfig.from() expects a string
    const serialized = serializeConfig(config)
    const configString = Buffer.isBuffer(serialized) ? serialized.toString('utf8') : serialized.toString()
    return GitConfig.from(configString)
  }

  /**
   * @deprecated Use `writeConfig()` from '../git/config.ts' instead
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
    // Delegate to the new implementation
    const normalizedFs = normalizeFs(fs)
    // Convert GitConfig to ConfigObject
    const configObject = parseConfig(Buffer.from(config.toString(), 'utf8'))
    await writeConfig({ fs: normalizedFs, gitdir, config: configObject })
  }
}

