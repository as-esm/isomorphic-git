export type { GitBackend } from './GitBackend.js'
export { FilesystemBackend } from './FilesystemBackend.js'
export { SQLiteBackend } from './SQLiteBackend.js'

/**
 * Creates a GitBackend instance based on the provided options
 */
export function createBackend(options: {
  type: 'filesystem' | 'sqlite'
  fs?: any // FsClient for filesystem backend
  gitdir?: string // Git directory path for filesystem backend
  dbPath?: string // Database path for SQLite backend
  sqliteModule?: any // Optional SQLite module
}): GitBackend {
  if (options.type === 'filesystem') {
    if (!options.fs || !options.gitdir) {
      throw new Error('Filesystem backend requires fs and gitdir options')
    }
    return new FilesystemBackend(options.fs, options.gitdir)
  } else if (options.type === 'sqlite') {
    if (!options.dbPath) {
      throw new Error('SQLite backend requires dbPath option')
    }
    return new SQLiteBackend(options.dbPath, options.sqliteModule)
  } else {
    throw new Error(`Unknown backend type: ${options.type}`)
  }
}

