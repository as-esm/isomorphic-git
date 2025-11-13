import { parse as parseConfig, serialize as serializeConfig, type ConfigObject } from './ConfigParser.js'
import { join } from './GitPath.js'
import type { FsClient } from "../models/FileSystem.ts"

type ConfigValueWithScope = {
  value: unknown
  scope: 'system' | 'global' | 'local'
}

/**
 * Unified Configuration Service that merges config from multiple sources
 * with proper precedence: local > global > system
 */
export class UnifiedConfigService {
  private _localConfig: ConfigObject | null = null
  private _globalConfig: ConfigObject | null = null
  private _systemConfig: ConfigObject | null = null
  private _mergedConfig: ConfigObject | null = null

  constructor(
    private readonly fs: FsClient,
    private readonly gitdir: string,
    private readonly systemConfigPath?: string,
    private readonly globalConfigPath?: string
  ) {}

  /**
   * Loads all config sources and merges them
   */
  async load(): Promise<void> {
    // Load system config
    if (this.systemConfigPath) {
      try {
        const systemBuffer = await this.fs.read(this.systemConfigPath)
        this._systemConfig = parseConfig(
          Buffer.isBuffer(systemBuffer) ? systemBuffer : Buffer.from(systemBuffer as string, 'utf8')
        )
      } catch {
        // System config doesn't exist, that's okay
        this._systemConfig = parseConfig(Buffer.alloc(0))
      }
    } else {
      this._systemConfig = parseConfig(Buffer.alloc(0))
    }

    // Load global config
    if (this.globalConfigPath) {
      try {
        const globalBuffer = await this.fs.read(this.globalConfigPath)
        this._globalConfig = parseConfig(
          Buffer.isBuffer(globalBuffer) ? globalBuffer : Buffer.from(globalBuffer as string, 'utf8')
        )
      } catch {
        // Global config doesn't exist, that's okay
        this._globalConfig = parseConfig(Buffer.alloc(0))
      }
    } else {
      this._globalConfig = parseConfig(Buffer.alloc(0))
    }

    // Load local config
    try {
      const localBuffer = await this.fs.read(join(this.gitdir, 'config'))
      this._localConfig = parseConfig(
        Buffer.isBuffer(localBuffer) ? localBuffer : Buffer.from(localBuffer as string, 'utf8')
      )
    } catch {
      // Local config doesn't exist yet
      this._localConfig = parseConfig(Buffer.alloc(0))
    }

    // Merge configs (local > global > system)
    this._mergedConfig = this._mergeConfigs(
      this._systemConfig,
      this._globalConfig,
      this._localConfig
    )
  }

  /**
   * Merges multiple config objects with precedence
   * @private
   */
  private _mergeConfigs(system: ConfigObject, global: ConfigObject, local: ConfigObject): ConfigObject {
    // Create a new config object
    const merged = parseConfig(Buffer.alloc(0))

    // Helper to copy all values from source to target
    // We iterate through parsedConfig to get all paths
    const copyConfig = (source: ConfigObject | null, target: ConfigObject): void => {
      if (source?.parsedConfig) {
        for (const entry of source.parsedConfig) {
          if (entry.path && entry.value !== undefined && entry.value !== null) {
            // Only copy variable entries, not section headers
            if (entry.name) {
              target.set(entry.path, entry.value)
            }
          }
        }
      }
    }

    // Merge in order: system, global, local (later overrides earlier)
    copyConfig(system, merged)
    copyConfig(global, merged)
    copyConfig(local, merged)

    return merged
  }

  /**
   * Gets a config value with proper precedence (local > global > system)
   */
  async get(path: string): Promise<unknown> {
    if (!this._mergedConfig) {
      await this.load()
    }
    return this._mergedConfig.get(path)
  }

  /**
   * Gets all values for a path from all sources
   */
  async getAll(path: string): Promise<ConfigValueWithScope[]> {
    if (!this._localConfig || !this._globalConfig || !this._systemConfig) {
      await this.load()
    }

    const results: ConfigValueWithScope[] = []
    const systemValue = this._systemConfig?.get(path)
    if (systemValue !== undefined) {
      results.push({ value: systemValue, scope: 'system' })
    }
    const globalValue = this._globalConfig?.get(path)
    if (globalValue !== undefined) {
      results.push({ value: globalValue, scope: 'global' })
    }
    const localValue = this._localConfig?.get(path)
    if (localValue !== undefined) {
      results.push({ value: localValue, scope: 'local' })
    }
    return results
  }

  /**
   * Sets a config value in the specified scope
   */
  async set(path: string, value: unknown, scope: 'local' | 'global' | 'system' = 'local', append = false): Promise<void> {
    if (scope === 'local') {
      if (!this._localConfig) {
        await this.load()
      }
      this._localConfig!.set(path, value, append)
      const configBuffer = serializeConfig(this._localConfig!)
      await this.fs.write(join(this.gitdir, 'config'), configBuffer)
      // Reload to update merged config
      await this.load()
    } else if (scope === 'global' && this.globalConfigPath) {
      if (!this._globalConfig) {
        await this.load()
      }
      this._globalConfig!.set(path, value, append)
      const configBuffer = serializeConfig(this._globalConfig!)
      await this.fs.write(this.globalConfigPath, configBuffer)
      await this.load()
    } else if (scope === 'system' && this.systemConfigPath) {
      if (!this._systemConfig) {
        await this.load()
      }
      this._systemConfig!.set(path, value, append)
      const configBuffer = serializeConfig(this._systemConfig!)
      await this.fs.write(this.systemConfigPath, configBuffer)
      await this.load()
    } else {
      throw new Error(`Cannot set ${scope} config: path not provided`)
    }
  }

  /**
   * Appends a config value (for multi-valued configs)
   */
  async append(path: string, value: unknown, scope: 'local' | 'global' | 'system' = 'local'): Promise<void> {
    await this.set(path, value, scope, true)
  }

  /**
   * Gets all subsections for a section from merged config
   */
  async getSubsections(section: string): Promise<(string | null)[]> {
    if (!this._mergedConfig) {
      await this.load()
    }
    return this._mergedConfig!.getSubsections(section)
  }

  /**
   * Gets all sections from merged config
   */
  async getSections(): Promise<string[]> {
    if (!this._mergedConfig) {
      await this.load()
    }
    const sections = new Set<string>()
    if (this._mergedConfig!.parsedConfig) {
      for (const entry of this._mergedConfig!.parsedConfig) {
        if (entry.isSection && entry.section) {
          sections.add(entry.section)
        }
      }
    }
    return Array.from(sections)
  }

  /**
   * Reloads all config sources
   */
  async reload(): Promise<void> {
    this._localConfig = null
    this._globalConfig = null
    this._systemConfig = null
    this._mergedConfig = null
    await this.load()
  }

  /**
   * Gets the raw merged config object (for advanced usage)
   */
  async getRawConfig(): Promise<ConfigObject> {
    if (!this._mergedConfig) {
      await this.load()
    }
    return this._mergedConfig!
  }
}

