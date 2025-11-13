/**
 * Example usage of Git Backends
 * 
 * This file demonstrates how to use both FilesystemBackend and SQLiteBackend
 * to store Git repository data.
 */

import type { FsClient } from "../models/FileSystem.ts"
import { FilesystemBackend, SQLiteBackend, createBackend } from './index.ts'

// ============================================================================
// Example 1: Using FilesystemBackend
// ============================================================================

export async function exampleFilesystemBackend(fs: FsClient, gitdir: string) {
  // Create a filesystem backend
  const backend = new FilesystemBackend(fs, gitdir)

  // Initialize the repository structure
  await backend.initialize()

  // Write HEAD
  await backend.writeHEAD('ref: refs/heads/main')

  // Write config
  const configData = Buffer.from('[core]\n\trepositoryformatversion = 0\n')
  await backend.writeConfig(configData)

  // Write a loose object
  const objectData = Buffer.from('deflated object data')
  await backend.writeLooseObject('abc123def456...', objectData)

  // Read it back
  const retrieved = await backend.readLooseObject('abc123def456...')
  console.log('Retrieved object:', retrieved)

  // Write a reference
  await backend.writeRef('refs/heads/main', 'abc123def456...')

  // Read the reference
  const refValue = await backend.readRef('refs/heads/main')
  console.log('Reference value:', refValue)

  // Append to reflog
  await backend.appendReflog('refs/heads/main', 'abc123... def456... author <email> timestamp +0000\tmessage\n')
}

// ============================================================================
// Example 2: Using SQLiteBackend
// ============================================================================

export async function exampleSQLiteBackend(dbPath: string) {
  // Create a SQLite backend
  // Note: In a real application, you might want to provide better-sqlite3
  // or another SQLite module
  const backend = new SQLiteBackend(dbPath)

  // Initialize the database schema
  await backend.initialize()

  // All operations are the same as FilesystemBackend
  await backend.writeHEAD('ref: refs/heads/main')

  const configData = Buffer.from('[core]\n\trepositoryformatversion = 0\n')
  await backend.writeConfig(configData)

  const objectData = Buffer.from('deflated object data')
  await backend.writeLooseObject('abc123def456...', objectData)

  const retrieved = await backend.readLooseObject('abc123def456...')
  console.log('Retrieved object:', retrieved)

  await backend.writeRef('refs/heads/main', 'abc123def456...')
  const refValue = await backend.readRef('refs/heads/main')
  console.log('Reference value:', refValue)

  // Clean up: close the database connection
  await backend.close()
}

// ============================================================================
// Example 3: Using the Factory Function
// ============================================================================

export async function exampleFactory(fs: FsClient, gitdir: string, dbPath: string) {
  // Create filesystem backend using factory
  const fsBackend = createBackend({
    type: 'filesystem',
    fs,
    gitdir,
  })

  // Create SQLite backend using factory
  const sqliteBackend = createBackend({
    type: 'sqlite',
    dbPath,
  })

  // Both backends implement the same interface
  await fsBackend.writeHEAD('ref: refs/heads/main')
  await sqliteBackend.writeHEAD('ref: refs/heads/main')

  // You can use them interchangeably
  const fsHead = await fsBackend.readHEAD()
  const sqliteHead = await sqliteBackend.readHEAD()

  console.log('Filesystem HEAD:', fsHead)
  console.log('SQLite HEAD:', sqliteHead)

  // Clean up
  await sqliteBackend.close()
}

// ============================================================================
// Example 4: Working with Packfiles
// ============================================================================

export async function examplePackfiles(backend: FilesystemBackend | SQLiteBackend) {
  // Write a packfile
  const packData = Buffer.from('packfile binary data')
  await backend.writePackfile('pack-abc123.pack', packData)

  // Write the corresponding index
  const indexData = Buffer.from('packfile index binary data')
  await backend.writePackIndex('pack-abc123.idx', indexData)

  // Write a bitmap (optional)
  const bitmapData = Buffer.from('bitmap binary data')
  await backend.writePackBitmap('pack-abc123.bitmap', bitmapData)

  // List all packfiles
  const packfiles = await backend.listPackfiles()
  console.log('Packfiles:', packfiles)

  // Read a packfile back
  const retrieved = await backend.readPackfile('pack-abc123.pack')
  console.log('Retrieved packfile:', retrieved)
}

// ============================================================================
// Example 5: Working with State Files
// ============================================================================

export async function exampleStateFiles(backend: FilesystemBackend | SQLiteBackend) {
  // Write state files (used during merge, rebase, etc.)
  await backend.writeStateFile('MERGE_HEAD', 'abc123def456...')
  await backend.writeStateFile('ORIG_HEAD', 'def456ghi789...')

  // Read state files
  const mergeHead = await backend.readStateFile('MERGE_HEAD')
  const origHead = await backend.readStateFile('ORIG_HEAD')

  console.log('MERGE_HEAD:', mergeHead)
  console.log('ORIG_HEAD:', origHead)

  // List all state files
  const stateFiles = await backend.listStateFiles()
  console.log('State files:', stateFiles)

  // Clean up after operation completes
  await backend.deleteStateFile('MERGE_HEAD')
  await backend.deleteStateFile('ORIG_HEAD')
}

// ============================================================================
// Example 6: Working with Reflogs
// ============================================================================

export async function exampleReflogs(backend: FilesystemBackend | SQLiteBackend) {
  // Append entries to reflog
  await backend.appendReflog(
    'refs/heads/main',
    'abc123 def456 author <email> 1234567890 +0000\tcommit: initial commit\n'
  )
  await backend.appendReflog(
    'refs/heads/main',
    'def456 ghi789 author <email> 1234567900 +0000\tcommit: add feature\n'
  )

  // Read the full reflog
  const reflog = await backend.readReflog('refs/heads/main')
  console.log('Reflog:', reflog)

  // List all reflogs
  const reflogs = await backend.listReflogs()
  console.log('All reflogs:', reflogs)
}

// ============================================================================
// Example 7: Working with Hooks
// ============================================================================

export async function exampleHooks(backend: FilesystemBackend | SQLiteBackend) {
  // Write a pre-commit hook
  const hookScript = Buffer.from('#!/bin/sh\necho "Running pre-commit hook"\n')
  await backend.writeHook('pre-commit', hookScript)

  // Check if hook exists
  const hasHook = await backend.hasHook('pre-commit')
  console.log('Has pre-commit hook:', hasHook)

  // Read the hook
  const hook = await backend.readHook('pre-commit')
  console.log('Hook content:', hook?.toString())

  // List all hooks
  const hooks = await backend.listHooks()
  console.log('All hooks:', hooks)
}

// ============================================================================
// Example 8: Advanced Features
// ============================================================================

export async function exampleAdvancedFeatures(backend: FilesystemBackend | SQLiteBackend) {
  // Shallow clone
  await backend.writeShallow('abc123def456...\nghi789jkl012...\n')

  // Git daemon export
  await backend.writeGitDaemonExportOk()
  const canExport = await backend.readGitDaemonExportOk()
  console.log('Can export via git daemon:', canExport)

  // Worktrees
  await backend.writeWorktreeConfig('worktree1', '/path/to/worktree1/.git')
  const worktrees = await backend.listWorktrees()
  console.log('Worktrees:', worktrees)

  // LFS files
  const lfsData = Buffer.from('LFS file content')
  await backend.writeLFSFile('objects/ab/cdef1234', lfsData)
  const lfsFiles = await backend.listLFSFiles()
  console.log('LFS files:', lfsFiles)
}

