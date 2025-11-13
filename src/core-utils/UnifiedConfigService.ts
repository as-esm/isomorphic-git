import { parse as parseConfig, serialize as serializeConfig, type ConfigObject } from './ConfigParser.ts'
import { join } from './GitPath.ts'
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
  private readonly fs: FsClient
  private readonly gitdir: string
  private readonly systemConfigPath?: string
  private readonly globalConfigPath?: string

  private _localConfig: ConfigObject | null = null
  private _globalConfig: ConfigObject | null = null
  private _systemConfig: ConfigObject | null = null
  private _mergedConfig: ConfigObject | null = null
  private _deletedConfigs: Set<string> = new Set()

  constructor(
    fs: FsClient,
    gitdir: string,
    systemConfigPath?: string,
    globalConfigPath?: string
  ) {
    this.fs = fs
    this.gitdir = gitdir
    this.systemConfigPath = systemConfigPath
    this.globalConfigPath = globalConfigPath
  }

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
    
    // Check if it was explicitly deleted first (before checking merged config)
    // This handles deletions within the same service instance
    if (this._deletedConfigs.has(path)) {
      return undefined
    }
    
    // The merged config's get() method also checks for deletion markers in the file
    const result = this._mergedConfig.get(path)
    // For boolean configs, return false instead of undefined when not found
    // BUT: if the config was in the file and got deleted, we can't distinguish that from "never existed"
    // So we only return false if it's a known boolean config that should default to false
    if (result === undefined) {
      // First, check if there's a deletion marker in any config source
      // This must be checked BEFORE the boolean config default logic
      const hasDeletionMarker = 
        this._localConfig?.parsedConfig.some(c => c.path === path + '.deleted') ||
        this._globalConfig?.parsedConfig.some(c => c.path === path + '.deleted') ||
        this._systemConfig?.parsedConfig.some(c => c.path === path + '.deleted')
      
      // If there's a deletion marker, return undefined (it was explicitly deleted)
      if (hasDeletionMarker) {
        return undefined
      }
      
      const parts = path.split('.')
      if (parts.length >= 2) {
        const section = parts[0]
        const name = parts.slice(1).join('.')
        // Boolean configs in core section that should default to false when never set
        const booleanConfigs: Record<string, string[]> = {
          core: ['symlinks', 'filemode', 'bare', 'logallrefupdates', 'ignorecase']
        }
        // Only return false if it's a boolean config AND it doesn't exist in any source
        if (booleanConfigs[section]?.includes(name)) {
          // Check if it exists in any source (as a regular config, not a deletion marker)
          const existsInLocal = this._localConfig?.parsedConfig.some(c => c.path === path && c.name && !c.path.endsWith('.deleted')) || false
          const existsInGlobal = this._globalConfig?.parsedConfig.some(c => c.path === path && c.name && !c.path.endsWith('.deleted')) || false
          const existsInSystem = this._systemConfig?.parsedConfig.some(c => c.path === path && c.name && !c.path.endsWith('.deleted')) || false
          if (!existsInLocal && !existsInGlobal && !existsInSystem) {
            return false
          }
          // If it exists in any source but result is undefined, it means it was deleted
          // In that case, return undefined (not false)
          return undefined
        }
      }
    }
    return result
  }

  /**
   * Gets all values for a path from all sources
   */
  async getAll(path: string): Promise<ConfigValueWithScope[]> {
    if (!this._localConfig || !this._globalConfig || !this._systemConfig) {
      await this.load()
    }

    const results: ConfigValueWithScope[] = []
    // Use getall() to get all values from each config source
    const systemValues = this._systemConfig?.getall(path) || []
    for (const value of systemValues) {
      if (value !== undefined) {
        results.push({ value, scope: 'system' })
      }
    }
    const globalValues = this._globalConfig?.getall(path) || []
    for (const value of globalValues) {
      if (value !== undefined) {
        results.push({ value, scope: 'global' })
      }
    }
    const localValues = this._localConfig?.getall(path) || []
    for (const value of localValues) {
      if (value !== undefined) {
        results.push({ value, scope: 'local' })
      }
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
      // Check if config existed before deletion
      const existedBefore = this._localConfig!.parsedConfig.some(c => c.path === path && c.name)
      this._localConfig!.set(path, value, append)
      // Track deletions - if it existed before and we're deleting it, mark it as deleted
      if (value == null && existedBefore) {
        this._deletedConfigs.add(path)
      } else {
        this._deletedConfigs.delete(path)
      }
      const configBuffer = serializeConfig(this._localConfig!)
      await this.fs.write(join(this.gitdir, 'config'), configBuffer)
      // Reload to update merged config
      await this.load()
    } else if (scope === 'global' && this.globalConfigPath) {
      if (!this._globalConfig) {
        await this.load()
      }
      // Check if config existed before deletion
      const existedBefore = this._globalConfig!.parsedConfig.some(c => c.path === path && c.name)
      this._globalConfig!.set(path, value, append)
      // Track deletions - if it existed before and we're deleting it, mark it as deleted
      if (value == null && existedBefore) {
        this._deletedConfigs.add(path)
      } else {
        this._deletedConfigs.delete(path)
      }
      const configBuffer = serializeConfig(this._globalConfig!)
      await this.fs.write(this.globalConfigPath, configBuffer)
      await this.load()
    } else if (scope === 'system' && this.systemConfigPath) {
      if (!this._systemConfig) {
        await this.load()
      }
      // Check if config existed before deletion
      const existedBefore = this._systemConfig!.parsedConfig.some(c => c.path === path && c.name)
      this._systemConfig!.set(path, value, append)
      // Track deletions - if it existed before and we're deleting it, mark it as deleted
      if (value == null && existedBefore) {
        this._deletedConfigs.add(path)
      } else {
        this._deletedConfigs.delete(path)
      }
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

