# Git Backend Implementations

This directory contains backend implementations for storing Git repository data. The `GitBackend` interface abstracts all storage operations, allowing you to use either a traditional filesystem-based backend or a SQLite-based backend.

## Backend Types

### FilesystemBackend

The `FilesystemBackend` stores all Git data using the traditional filesystem structure, compatible with standard Git repositories. This is the default backend and maintains full compatibility with native Git.

**Usage:**
```typescript
import { FilesystemBackend } from './backends/index.js'
import type { FsClient } from '../types.js'

const backend = new FilesystemBackend(fs, '/path/to/.git')
await backend.initialize()
```

### SQLiteBackend

The `SQLiteBackend` stores all Git data in a single SQLite database file. This provides:
- Single-file repository format (easy to backup/transfer)
- Atomic transactions
- Better performance for certain operations
- Cross-platform compatibility

**Usage:**
```typescript
import { SQLiteBackend } from './backends/index.js'
import Database from 'better-sqlite3'

// Option 1: Use better-sqlite3 (Node.js)
const backend = new SQLiteBackend('/path/to/repo.db')
await backend.initialize()

// Option 2: Provide your own SQLite module
const sqlite = require('better-sqlite3')
const backend = new SQLiteBackend('/path/to/repo.db', sqlite)
await backend.initialize()
```

## Backend Factory

Use the `createBackend` function to create backends dynamically:

```typescript
import { createBackend } from './backends/index.js'

// Filesystem backend
const fsBackend = createBackend({
  type: 'filesystem',
  fs: myFsClient,
  gitdir: '/path/to/.git'
})

// SQLite backend
const sqliteBackend = createBackend({
  type: 'sqlite',
  dbPath: '/path/to/repo.db',
  sqliteModule: mySqliteModule // optional
})
```

## Complete Feature Coverage

Both backends implement the full `GitBackend` interface, covering:

### Core Metadata & Current State
- HEAD pointer
- Config file
- Index (staging area)
- Description
- State files (FETCH_HEAD, ORIG_HEAD, MERGE_HEAD, CHERRY_PICK_HEAD, REVERT_HEAD, BISECT_*)
- Sequencer files (for rebase/cherry-pick operations)

### Object Database (ODB)
- Loose objects (stored in `objects/[00-ff]/`)
- Packfiles (`.pack`, `.idx`, `.bitmap`)
- ODB info files (alternates, commit-graph, multi-pack-index, packs)

### References
- Loose refs (`refs/heads/`, `refs/tags/`, `refs/remotes/`, `refs/notes/`, `refs/replace/`)
- Packed refs (`packed-refs`)

### Reflogs
- Reflog files for HEAD and all refs (`logs/HEAD`, `logs/refs/heads/`, etc.)

### Info Files
- `info/exclude` (repository-specific gitignore)
- `info/attributes` (repository-specific gitattributes)
- `info/grafts` (legacy, replaced by `refs/replace/`)

### Hooks
- All hook files (`hooks/pre-commit`, `hooks/post-receive`, etc.)

### Advanced Features
- Submodules (`modules/`)
- Worktrees (`worktrees/`)
- Git LFS (`lfs/`)
- Shallow clones (`shallow`)
- Git daemon export (`git-daemon-export-ok`)

## Migration Between Backends

To migrate from filesystem to SQLite (or vice versa), you would need to:

1. Read all data from the source backend
2. Write all data to the target backend

Example migration utility (pseudo-code):
```typescript
async function migrateBackend(source: GitBackend, target: GitBackend) {
  // Migrate core metadata
  const head = await source.readHEAD()
  await target.writeHEAD(head)
  
  const config = await source.readConfig()
  await target.writeConfig(config)
  
  // ... migrate all other data
}
```

## Performance Considerations

### FilesystemBackend
- Fast for small repositories
- Native Git compatibility
- Can leverage OS-level caching
- Slower for large repositories with many files

### SQLiteBackend
- Better for large repositories (single file, indexed)
- Atomic transactions for complex operations
- Can be slower for very small repositories (overhead)
- Requires SQLite library

## Thread Safety

Both backends are designed to be thread-safe:
- **FilesystemBackend**: Relies on the underlying filesystem's atomic operations
- **SQLiteBackend**: Uses WAL mode for better concurrency

## Error Handling

Both backends handle missing files gracefully by returning `null` or empty buffers, consistent with Git's behavior.

