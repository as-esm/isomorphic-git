/**
 * GitBackend - Abstract interface for Git repository storage backends
 * 
 * This interface abstracts all storage operations for a Git repository,
 * allowing implementations using filesystem, SQLite, or other storage mechanisms.
 */
export type GitBackend = {
  // ============================================================================
  // Core Metadata & Current State
  // ============================================================================

  /**
   * Reads the HEAD pointer (ref or SHA)
   */
  readHEAD(): Promise<string>

  /**
   * Writes the HEAD pointer
   */
  writeHEAD(value: string): Promise<void>

  /**
   * Reads the repository config file
   */
  readConfig(): Promise<Buffer>

  /**
   * Writes the repository config file
   */
  writeConfig(data: Buffer): Promise<void>

  /**
   * Reads the index (staging area)
   */
  readIndex(): Promise<Buffer>

  /**
   * Writes the index (staging area)
   */
  writeIndex(data: Buffer): Promise<void>

  /**
   * Reads the description file
   */
  readDescription(): Promise<string | null>

  /**
   * Writes the description file
   */
  writeDescription(description: string): Promise<void>

  /**
   * Reads a temporary state file (FETCH_HEAD, ORIG_HEAD, MERGE_HEAD, etc.)
   */
  readStateFile(name: string): Promise<string | null>

  /**
   * Writes a temporary state file
   */
  writeStateFile(name: string, value: string): Promise<void>

  /**
   * Deletes a temporary state file
   */
  deleteStateFile(name: string): Promise<void>

  /**
   * Lists all state files
   */
  listStateFiles(): Promise<string[]>

  // ============================================================================
  // Sequencer Operations
  // ============================================================================

  /**
   * Reads a sequencer file (for rebase/cherry-pick operations)
   */
  readSequencerFile(name: string): Promise<string | null>

  /**
   * Writes a sequencer file
   */
  writeSequencerFile(name: string, data: string): Promise<void>

  /**
   * Deletes a sequencer file
   */
  deleteSequencerFile(name: string): Promise<void>

  /**
   * Lists all sequencer files
   */
  listSequencerFiles(): Promise<string[]>

  // ============================================================================
  // Object Database (ODB)
  // ============================================================================

  /**
   * Reads a loose object from the ODB
   * @param oid - The object ID (SHA-1)
   * @returns The deflated object data, or null if not found
   */
  readLooseObject(oid: string): Promise<Buffer | null>

  /**
   * Writes a loose object to the ODB
   * @param oid - The object ID (SHA-1)
   * @param data - The deflated object data
   */
  writeLooseObject(oid: string, data: Buffer): Promise<void>

  /**
   * Checks if a loose object exists
   */
  hasLooseObject(oid: string): Promise<boolean>

  /**
   * Lists all loose object OIDs (for garbage collection)
   */
  listLooseObjects(): Promise<string[]>

  /**
   * Reads a packfile
   */
  readPackfile(name: string): Promise<Buffer | null>

  /**
   * Writes a packfile
   */
  writePackfile(name: string, data: Buffer): Promise<void>

  /**
   * Lists all packfiles
   */
  listPackfiles(): Promise<string[]>

  /**
   * Reads a packfile index (.idx)
   */
  readPackIndex(name: string): Promise<Buffer | null>

  /**
   * Writes a packfile index
   */
  writePackIndex(name: string, data: Buffer): Promise<void>

  /**
   * Reads a packfile bitmap (.bitmap)
   */
  readPackBitmap(name: string): Promise<Buffer | null>

  /**
   * Writes a packfile bitmap
   */
  writePackBitmap(name: string, data: Buffer): Promise<void>

  /**
   * Reads an ODB info file (alternates, commit-graph, packs)
   */
  readODBInfoFile(name: string): Promise<string | null>

  /**
   * Writes an ODB info file
   */
  writeODBInfoFile(name: string, data: string): Promise<void>

  /**
   * Deletes an ODB info file
   */
  deleteODBInfoFile(name: string): Promise<void>

  /**
   * Reads the multi-pack-index file
   */
  readMultiPackIndex(): Promise<Buffer | null>

  /**
   * Writes the multi-pack-index file
   */
  writeMultiPackIndex(data: Buffer): Promise<void>

  /**
   * Checks if multi-pack-index exists
   */
  hasMultiPackIndex(): Promise<boolean>

  // ============================================================================
  // References
  // ============================================================================

  /**
   * Reads a reference file (refs/heads/*, refs/tags/*, etc.)
   * @param ref - The reference path (e.g., 'refs/heads/main')
   * @returns The OID or symbolic ref target, or null if not found
   */
  readRef(ref: string): Promise<string | null>

  /**
   * Writes a reference file
   * @param ref - The reference path
   * @param value - The OID or symbolic ref target (e.g., 'ref: refs/heads/main')
   */
  writeRef(ref: string, value: string): Promise<void>

  /**
   * Deletes a reference file
   */
  deleteRef(ref: string): Promise<void>

  /**
   * Lists all references matching a prefix
   * @param prefix - The prefix to match (e.g., 'refs/heads/')
   * @returns Array of reference paths
   */
  listRefs(prefix: string): Promise<string[]>

  /**
   * Checks if a reference exists
   */
  hasRef(ref: string): Promise<boolean>

  /**
   * Reads the packed-refs file
   */
  readPackedRefs(): Promise<string | null>

  /**
   * Writes the packed-refs file
   */
  writePackedRefs(data: string): Promise<void>

  // ============================================================================
  // Reflogs
  // ============================================================================

  /**
   * Reads a reflog file
   * @param ref - The reference path
   * @returns The reflog content, or null if not found
   */
  readReflog(ref: string): Promise<string | null>

  /**
   * Writes a reflog file
   */
  writeReflog(ref: string, data: string): Promise<void>

  /**
   * Appends to a reflog file
   */
  appendReflog(ref: string, entry: string): Promise<void>

  /**
   * Deletes a reflog file
   */
  deleteReflog(ref: string): Promise<void>

  /**
   * Lists all reflog files
   */
  listReflogs(): Promise<string[]>

  // ============================================================================
  // Info Files
  // ============================================================================

  /**
   * Reads an info file (exclude, attributes, grafts)
   */
  readInfoFile(name: string): Promise<string | null>

  /**
   * Writes an info file
   */
  writeInfoFile(name: string, data: string): Promise<void>

  /**
   * Deletes an info file
   */
  deleteInfoFile(name: string): Promise<void>

  // ============================================================================
  // Hooks
  // ============================================================================

  /**
   * Reads a hook file
   */
  readHook(name: string): Promise<Buffer | null>

  /**
   * Writes a hook file
   */
  writeHook(name: string, data: Buffer): Promise<void>

  /**
   * Deletes a hook file
   */
  deleteHook(name: string): Promise<void>

  /**
   * Lists all hook files
   */
  listHooks(): Promise<string[]>

  /**
   * Checks if a hook exists
   */
  hasHook(name: string): Promise<boolean>

  // ============================================================================
  // Advanced Features
  // ============================================================================

  /**
   * Reads a submodule config file
   */
  readSubmoduleConfig(path: string): Promise<string | null>

  /**
   * Writes a submodule config file
   */
  writeSubmoduleConfig(path: string, data: string): Promise<void>

  /**
   * Reads a worktree config file
   */
  readWorktreeConfig(name: string): Promise<string | null>

  /**
   * Writes a worktree config file
   */
  writeWorktreeConfig(name: string, data: string): Promise<void>

  /**
   * Lists all worktrees
   */
  listWorktrees(): Promise<string[]>

  /**
   * Reads the shallow file
   */
  readShallow(): Promise<string | null>

  /**
   * Writes the shallow file
   */
  writeShallow(data: string): Promise<void>

  /**
   * Deletes the shallow file
   */
  deleteShallow(): Promise<void>

  /**
   * Reads an LFS file
   */
  readLFSFile(path: string): Promise<Buffer | null>

  /**
   * Writes an LFS file
   */
  writeLFSFile(path: string, data: Buffer): Promise<void>

  /**
   * Lists LFS files
   */
  listLFSFiles(prefix?: string): Promise<string[]>

  /**
   * Reads the git-daemon-export-ok file
   */
  readGitDaemonExportOk(): Promise<boolean>

  /**
   * Writes the git-daemon-export-ok file
   */
  writeGitDaemonExportOk(): Promise<void>

  /**
   * Deletes the git-daemon-export-ok file
   */
  deleteGitDaemonExportOk(): Promise<void>

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Initializes the backend (creates necessary structure)
   */
  initialize(): Promise<void>

  /**
   * Checks if the backend is initialized
   */
  isInitialized(): Promise<boolean>

  /**
   * Closes the backend (for cleanup, e.g., closing database connections)
   */
  close(): Promise<void>

  /**
   * Gets the backend type identifier
   */
  getType(): string
}

