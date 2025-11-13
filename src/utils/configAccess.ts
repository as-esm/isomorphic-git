import { UnifiedConfigService } from '../core-utils/UnifiedConfigService.js'
import type { FsClient } from '../models/FileSystem.js'

/**
 * Unified config access utility
 * Provides a simpler API around UnifiedConfigService
 * Replaces direct _getConfig() calls and GitConfigManager usage
 */
export class ConfigAccess {
  private _service: UnifiedConfigService | null = null

  constructor(
    private readonly fs: FsClient,
    private readonly gitdir: string,
    private readonly systemConfigPath?: string,
    private readonly globalConfigPath?: string
  ) {}

  /**
   * Gets the UnifiedConfigService instance, loading configs if needed
   */
  private async getService(): Promise<UnifiedConfigService> {
    if (!this._service) {
      this._service = new UnifiedConfigService(this.fs, this.gitdir, this.systemConfigPath, this.globalConfigPath)
      await this._service.load()
    }
    return this._service
  }

  /**
   * Gets a single config value (returns first match from merged config)
   */
  async getConfigValue(path: string): Promise<unknown> {
    const service = await this.getService()
    return service.get(path)
  }

  /**
   * Gets all config values for a path (from all scopes)
   */
  async getAllConfigValues(path: string): Promise<Array<{ value: unknown; scope: 'system' | 'global' | 'local' }>> {
    const service = await this.getService()
    return service.getAll(path)
  }

  /**
   * Sets a config value in the specified scope
   */
  async setConfigValue(
    path: string,
    value: unknown,
    scope: 'local' | 'global' | 'system' = 'local'
  ): Promise<void> {
    const service = await this.getService()
    await service.set(path, value, scope, false)
  }

  /**
   * Appends a config value (for multi-valued configs)
   */
  async appendConfigValue(
    path: string,
    value: unknown,
    scope: 'local' | 'global' | 'system' = 'local'
  ): Promise<void> {
    const service = await this.getService()
    await service.append(path, value, scope)
  }

  /**
   * Deletes a config value (sets to undefined)
   */
  async deleteConfigValue(path: string, scope: 'local' | 'global' | 'system' = 'local'): Promise<void> {
    await this.setConfigValue(path, undefined, scope)
  }

  /**
   * Gets all subsections for a section
   */
  async getSubsections(section: string): Promise<(string | null)[]> {
    const service = await this.getService()
    return service.getSubsections(section)
  }

  /**
   * Reloads config from all sources
   */
  async reload(): Promise<void> {
    if (this._service) {
      await this._service.load()
    } else {
      await this.getService()
    }
  }
}

/**
 * Convenience function to get a config value
 */
export async function getConfigValue(
  fs: FsClient,
  gitdir: string,
  path: string,
  systemConfigPath?: string,
  globalConfigPath?: string
): Promise<unknown> {
  const access = new ConfigAccess(fs, gitdir, systemConfigPath, globalConfigPath)
  return access.getConfigValue(path)
}

/**
 * Convenience function to set a config value
 */
export async function setConfigValue(
  fs: FsClient,
  gitdir: string,
  path: string,
  value: unknown,
  scope: 'local' | 'global' | 'system' = 'local',
  systemConfigPath?: string,
  globalConfigPath?: string
): Promise<void> {
  const access = new ConfigAccess(fs, gitdir, systemConfigPath, globalConfigPath)
  await access.setConfigValue(path, value, scope)
}

