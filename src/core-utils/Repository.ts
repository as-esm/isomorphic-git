import { NotFoundError } from '../errors/NotFoundError.js'
import { _findRoot } from "../commands/findRoot.ts"
import { join } from './GitPath.js'
import { UnifiedConfigService } from './UnifiedConfigService.js'
import { StateManager } from './StateManager.js'
import { RefManager } from './refs/RefManager.js'
import type { FsClient } from "../models/FileSystem.ts"

type ObjectReaderWrapper = {
  read: (params: {
    oid: string
    format?: 'content' | 'parsed' | 'deflated' | 'wrapped'
  }) => Promise<unknown>
}

type ObjectWriterWrapper = {
  write: (params: {
    type: string
    content: Buffer | Uint8Array
    format?: 'wrapped' | 'deflated' | 'content'
  }) => Promise<string>
}

/**
 * Repository Context Object - Central representation of a Git repository
 * Provides lazy-loaded access to all low-level managers
 */
export class Repository {
  private _config: UnifiedConfigService | null = null
  private _stateManager: StateManager | null = null
  private _objectReader: ObjectReaderWrapper | null = null
  private _objectWriter: ObjectWriterWrapper | null = null
  private _index: unknown | null = null
  private _isBare: boolean | null = null

  constructor(
    public readonly fs: FsClient,
    private _dir: string | null,
    private _gitdir: string | null,
    public readonly cache: Record<string, unknown> = {},
    private readonly _systemConfigPath?: string,
    private readonly _globalConfigPath?: string
  ) {}

  /**
   * Opens a repository from a directory
   */
  static async open({
    fs,
    dir,
    cache = {},
    systemConfigPath,
    globalConfigPath,
  }: {
    fs: FsClient
    dir: string
    cache?: Record<string, unknown>
    systemConfigPath?: string
    globalConfigPath?: string
  }): Promise<Repository> {
    // Try to find .git directory
    let gitdir: string
    let workingDir: string | null = dir

    try {
      // Check if dir itself is a bare repo (has config file directly)
      const configPath = join(dir, 'config')
      const isBare = await fs.exists(configPath)
      if (isBare) {
        gitdir = dir
        workingDir = null
      } else {
        // Find .git directory by walking up
        const root = await _findRoot({ fs, filepath: dir })
        gitdir = join(root, '.git')
        workingDir = root
      }
    } catch (err) {
      if (err instanceof NotFoundError) {
        // No git repo found
        throw new NotFoundError(`Not a git repository: ${dir}`)
      }
      throw err
    }

    return new Repository(fs, workingDir, gitdir, cache, systemConfigPath, globalConfigPath)
  }

  /**
   * Gets the working directory
   */
  get dir(): string | null {
    return this._dir
  }

  /**
   * Gets the git directory
   */
  async getGitdir(): Promise<string> {
    if (this._gitdir) {
      return this._gitdir
    }
    if (this._dir) {
      // Find .git directory
      const root = await _findRoot({ fs: this.fs, filepath: this._dir })
      this._gitdir = join(root, '.git')
      return this._gitdir
    }
    throw new Error('Cannot determine gitdir: neither dir nor gitdir provided')
  }

  /**
   * Checks if repository is bare
   */
  async isBare(): Promise<boolean> {
    if (this._isBare === null) {
      const gitdir = await this.getGitdir()
      // Check if config exists directly in gitdir (bare) or in gitdir/.git (non-bare)
      const configPath = join(gitdir, 'config')
      const configExists = await this.fs.exists(configPath)
      if (configExists) {
        // Read config to check bare setting
        try {
          const { ConfigAccess } = await import('../utils/configAccess.js')
          const configAccess = new ConfigAccess(this.fs, gitdir)
          const bare = await configAccess.getConfigValue('core.bare')
          this._isBare = bare === 'true' || bare === true
        } catch {
          // Default to non-bare if can't read config
          this._isBare = false
        }
      } else {
        this._isBare = false
      }
    }
    return this._isBare
  }

  /**
   * Gets the unified configuration service
   */
  async getConfig(): Promise<UnifiedConfigService> {
    if (!this._config) {
      const gitdir = await this.getGitdir()
      this._config = new UnifiedConfigService(
        this.fs,
        gitdir,
        this._systemConfigPath,
        this._globalConfigPath
      )
      await this._config.load()
    }
    return this._config
  }

  /**
   * Gets the state manager
   */
  async getStateManager(): Promise<StateManager> {
    if (!this._stateManager) {
      const gitdir = await this.getGitdir()
      this._stateManager = new StateManager(this.fs, gitdir)
    }
    return this._stateManager
  }

  /**
   * Gets the ref manager
   */
  async getRefManager(): Promise<typeof RefManager> {
    // RefManager is static, but we return it for consistency
    return RefManager
  }

  /**
   * Gets the object reader
   */
  async getObjectReader(): Promise<ObjectReaderWrapper> {
    if (!this._objectReader) {
      const gitdir = await this.getGitdir()
      const { read } = await import('./odb/ObjectReader.js')
      // ObjectReader exports functions, we'll create a wrapper
      this._objectReader = {
        read: async (params) => {
          return read({
            ...params,
            fs: this.fs,
            gitdir,
            cache: this.cache,
          })
        },
      }
    }
    return this._objectReader
  }

  /**
   * Gets the object writer
   */
  async getObjectWriter(): Promise<ObjectWriterWrapper> {
    if (!this._objectWriter) {
      const gitdir = await this.getGitdir()
      const { write } = await import('./odb/ObjectWriter.js')
      // ObjectWriter exports functions, we'll create a wrapper
      this._objectWriter = {
        write: async (params) => {
          return write({
            ...params,
            fs: this.fs,
            gitdir,
          })
        },
      }
    }
    return this._objectWriter
  }

  /**
   * Gets the parsed index
   */
  async getIndex(): Promise<unknown> {
    if (!this._index) {
      const gitdir = await this.getGitdir()
      try {
        const indexBuffer = await this.fs.read(join(gitdir, 'index'))
        const { parse: parseIndex } = await import('./index/Index.js')
        this._index = await parseIndex(indexBuffer)
      } catch (err) {
        if ((err as { code?: string }).code === 'NOENT') {
          // Index doesn't exist yet, create empty one
          const { parse: parseIndex } = await import('./index/Index.js')
          this._index = await parseIndex(Buffer.alloc(0))
        } else {
          throw err
        }
      }
    }
    return this._index
  }

  /**
   * Writes the index back to disk
   */
  async writeIndex(index: unknown): Promise<void> {
    const gitdir = await this.getGitdir()
    const { serialize: serializeIndex } = await import('./index/Index.js')
    const indexBuffer = await serializeIndex(index)
    await this.fs.write(join(gitdir, 'index'), indexBuffer)
    // Invalidate cached index
    this._index = index
  }

  /**
   * Resolves a ref to an OID
   */
  async resolveRef(ref: string, depth?: number): Promise<string> {
    const gitdir = await this.getGitdir()
    return RefManager.resolve({ fs: this.fs, gitdir, ref, depth })
  }

  /**
   * Lists refs matching a prefix
   */
  async listRefs(filepath: string): Promise<string[]> {
    const gitdir = await this.getGitdir()
    return RefManager.listRefs({ fs: this.fs, gitdir, filepath })
  }

  /**
   * Writes a ref
   */
  async writeRef(ref: string, value: string): Promise<void> {
    const gitdir = await this.getGitdir()
    return RefManager.writeRef({ fs: this.fs, gitdir, ref, value })
  }

  /**
   * Invalidates cached data (useful after operations that modify the repo)
   */
  async invalidateCache(): Promise<void> {
    this._index = null
    this._isBare = null
    if (this._config) {
      await this._config.reload()
    }
  }
}

