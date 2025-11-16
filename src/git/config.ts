import { UnifiedConfigService } from '../core-utils/UnifiedConfigService.ts'
import { parse as parseConfig, serialize as serializeConfig, type ConfigObject } from '../core-utils/ConfigParser.ts'
import { join } from '../core-utils/GitPath.ts'
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Read configuration value from the repository
 * 
 * @param fs - File system client
 * @param gitdir - Path to .git directory
 * @param path - Config path (e.g., 'user.name', 'remote.origin.url')
 * @param systemConfigPath - Optional path to system config
 * @param globalConfigPath - Optional path to global config
 * @returns Promise resolving to the config value, or undefined if not found
 */
export async function getConfig({
  fs,
  gitdir,
  path,
  systemConfigPath,
  globalConfigPath,
}: {
  fs: FsClient
  gitdir: string
  path: string
  systemConfigPath?: string
  globalConfigPath?: string
}): Promise<unknown> {
  const service = new UnifiedConfigService(fs, gitdir, systemConfigPath, globalConfigPath)
  await service.load()
  return service.get(path)
}

/**
 * Set configuration value in the repository
 * 
 * @param fs - File system client
 * @param gitdir - Path to .git directory
 * @param path - Config path (e.g., 'user.name', 'remote.origin.url')
 * @param value - Value to set
 * @param systemConfigPath - Optional path to system config
 * @param globalConfigPath - Optional path to global config
 */
export async function setConfig({
  fs,
  gitdir,
  path,
  value,
  systemConfigPath,
  globalConfigPath,
}: {
  fs: FsClient
  gitdir: string
  path: string
  value: unknown
  systemConfigPath?: string
  globalConfigPath?: string
}): Promise<void> {
  const service = new UnifiedConfigService(fs, gitdir, systemConfigPath, globalConfigPath)
  await service.load()
  await service.set(path, value)
  await service.save()
}

/**
 * Get all configuration values matching a path pattern
 * 
 * @param fs - File system client
 * @param gitdir - Path to .git directory
 * @param path - Config path pattern (e.g., 'remote.*.url')
 * @param systemConfigPath - Optional path to system config
 * @param globalConfigPath - Optional path to global config
 * @returns Promise resolving to array of config values with their paths
 */
export async function getConfigAll({
  fs,
  gitdir,
  path,
  systemConfigPath,
  globalConfigPath,
}: {
  fs: FsClient
  gitdir: string
  path: string
  systemConfigPath?: string
  globalConfigPath?: string
}): Promise<Array<{ path: string; value: unknown }>> {
  const service = new UnifiedConfigService(fs, gitdir, systemConfigPath, globalConfigPath)
  await service.load()
  return service.getAll(path)
}

/**
 * Read the raw local config file
 * 
 * @param fs - File system client
 * @param gitdir - Path to .git directory
 * @returns Promise resolving to the parsed config object
 */
export async function readConfig({
  fs,
  gitdir,
}: {
  fs: FsClient
  gitdir: string
}): Promise<ConfigObject> {
  const configPath = join(gitdir, 'config')
  try {
    const buffer = await fs.read(configPath)
    const configBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as string | Uint8Array)
    return parseConfig(configBuffer)
  } catch {
    // Config doesn't exist yet - return empty config
    return parseConfig(Buffer.alloc(0))
  }
}

/**
 * Write the raw local config file
 * 
 * @param fs - File system client
 * @param gitdir - Path to .git directory
 * @param config - Config object to write
 */
export async function writeConfig({
  fs,
  gitdir,
  config,
}: {
  fs: FsClient
  gitdir: string
  config: ConfigObject
}): Promise<void> {
  const configPath = join(gitdir, 'config')
  const serialized = serializeConfig(config)
  await fs.write(configPath, serialized)
}

