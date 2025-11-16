# New Implementations Documentation

This document details all new implementations created in the isomorphic-git codebase, organized by category.

## Mission and Architecture Direction

**Primary Goal**: Restructure the codebase to match the actual `.git` directory structure for better maintainability, intuitive navigation, and alignment with Git's native organization.

**Current Status**: Migration in progress - Index operations have been migrated to `src/git/index/`, with refs and object database migrations planned.

**Target Structure**: Code organization will mirror the `.git` directory:
- `src/git/index/` → `.git/index` operations
- `src/git/refs/` → `.git/refs/` operations  
- `src/git/objects/` → `.git/objects/` operations
- `src/git/config.ts` → `.git/config` operations
- `src/git/HEAD.ts` → `.git/HEAD` operations
- And so on...

**Benefits**:
1. **Intuitive Navigation**: Want to work with index? Look in `src/git/index/`
2. **Single Source of Truth**: `.git/index` file is the source of truth
3. **Less Abstraction**: Direct file operations, less indirection
4. **Easier Debugging**: Can trace code to specific `.git` files
5. **Better Maintainability**: Structure matches Git's actual organization

**Migration Strategy**: Gradual migration while maintaining backward compatibility. Old managers will be kept as thin wrappers during transition, then removed once migration is complete.

For detailed migration status and plans, see [PROJECT_STATE.md](./PROJECT_STATE.md).

## 1. Model Classes

### 1.1 GitConfig (`src/models/GitConfig.ts`)

**Purpose**: Parses and manages Git configuration files (.git/config)

**Key Features**:
- Parses Git config file format with sections, subsections, and variables
- Supports schema-based type conversion (boolean, numeric with unit factors)
- Handles comments, quotes, and escaping in config values
- Provides methods: `get()`, `getall()`, `set()`, `append()`, `deleteSection()`, `getSubsections()`
- Maintains original line structure for unmodified entries
- Converts config back to string format with `toString()`

**Implementation Details**:
- Uses regex patterns for parsing section lines `[section "subsection"]` and variable lines
- Normalizes paths using dot notation (e.g., `core.filemode`)
- Tracks modifications to preserve original formatting
- Supports implicit boolean values (variable name without value = true)
- Handles quoted values and escaped characters
- Removes comments while preserving quoted comment characters

### 1.2 GitPktLine (`src/models/GitPktLine.ts`)

**Purpose**: Handles Git packet-line protocol encoding/decoding

**Key Features**:
- Static methods for encoding strings/Buffers to pkt-line format
- Creates flush packets (`0000`) and delimiter packets (`0001`)
- Provides stream reader for parsing pkt-lines from async iterables
- Handles variable-length binary strings with 4-byte hex length prefix
- Supports maximum payload of 65516 bytes

**Implementation Details**:
- Uses `StreamReader` utility for reading from streams
- Implements pkt-line format specification from Git protocol
- Returns special values: `null` for flush/delim, `true` for end of stream
- Length field includes 4 bytes for the length itself
- Handles binary data (8-bit clean)

## 2. Manager Classes

### 2.1 GitConfigManager (`src/managers/GitConfigManager.ts`)

**Purpose**: Manages access to Git configuration files with file system operations

**Key Features**:
- Static methods: `get()` and `save()`
- Reads config from `.git/config` file
- Writes config back to file system
- Uses `normalizeFs()` utility for consistent filesystem handling

**Implementation Details**:
- Returns `GitConfig` instances from file content
- Handles encoding (UTF-8) for config file operations
- TODO: Support reading from full list of git config files (system, global, local)
- TODO: Handle saving to correct config location based on scope
- Provides abstraction layer between file system and GitConfig model

### 2.2 GitIgnoreManager (`src/managers/GitIgnoreManager.ts`)

**Purpose**: Determines whether files are ignored based on `.gitignore` rules

**Key Features**:
- Static method: `isIgnored()`
- Checks multiple `.gitignore` files in directory hierarchy
- Handles `.git/info/exclude` file for project-specific exclusions
- Respects parent directory exclusion rules (can't re-include if parent is excluded)
- Always ignores `.git` folders

**Implementation Details**:
- Uses `ignore` npm package for pattern matching
- Walks up directory tree to find all relevant `.gitignore` files
- Combines exclusion rules from multiple sources
- Designed for future caching optimizations
- Handles edge cases like root directory (`.`) which is never ignored

## 3. Error Classes

### 3.1 InvalidOidError (`src/errors/InvalidOidError.ts`)

**Purpose**: Error for invalid Git object IDs

**Features**:
- Extends `BaseError`
- Static code: `'InvalidOidError'`
- Validates 40-character hex object IDs
- Stores invalid value in error data
- Provides clear error message indicating expected format

### 3.2 SmartHttpError (`src/errors/SmartHttpError.ts`)

**Purpose**: Error for smart HTTP protocol violations

**Features**:
- Extends `BaseError`
- Static code: `'SmartHttpError'`
- Validates that remote replies using "smart" HTTP protocol
- Stores preview and full response in error data
- Supports error chaining with cause
- Provides diagnostic information for protocol debugging

## 4. Utility Functions and Classes

### 4.1 normalizeFs (`src/utils/normalizeFs.ts`)

**Purpose**: Normalizes `FsClient` to `FileSystem` instance

**Key Features**:
- Prevents redundant wrapping of already-wrapped FileSystem instances
- Ensures consistent FileSystem API usage
- Part of FsClient/FileSystem standardization effort

**Implementation Details**:
- Leverages FileSystem constructor's built-in check for `_original_unwrapped_fs`
- Returns existing instance if already wrapped, otherwise creates new instance
- Simplifies filesystem handling throughout codebase
- Reduces memory overhead from redundant wrapping

### 4.2 errorFactory (`src/utils/errorFactory.ts`)

**Purpose**: Factory functions for creating standardized error classes

**Key Features**:
- `createErrorClass()`: Creates error classes with static code and data
- `createTypedErrorClass()`: Creates error classes with typed data and message builder
- Reduces redundancy across error class definitions
- All created errors extend `BaseError`

**Implementation Details**:
- Supports both string and function-based default messages
- Automatically sets `code`, `name`, and `data` properties
- Enables consistent error creation patterns
- Type-safe error data handling

### 4.3 ConfigAccess (`src/utils/configAccess.ts`)

**Purpose**: Unified config access utility providing simpler API around UnifiedConfigService

**Key Features**:
- Class-based interface for config operations
- Methods: `getConfigValue()`, `getAllConfigValues()`, `setConfigValue()`, `appendConfigValue()`, `deleteConfigValue()`, `getSubsections()`, `reload()`
- Supports system, global, and local config scopes
- Lazy loading of UnifiedConfigService
- Convenience functions: `getConfigValue()`, `setConfigValue()`

**Implementation Details**:
- Wraps `UnifiedConfigService` for backward compatibility
- Replaces direct `_getConfig()` calls and `GitConfigManager` usage
- Handles config merging from multiple sources
- Provides simpler API than direct UnifiedConfigService usage

### 4.4 createApiWrapper (`src/utils/apiWrapper.ts`)

**Purpose**: Creates standardized API wrapper functions for commands

**Key Features**:
- Reduces redundancy across all read/write API functions
- Handles parameter validation using `assertParameter()`
- Resolves `gitdir` from `dir` parameter automatically
- Wraps errors with caller information using `withErrorCaller()`

**Implementation Details**:
- Generic function supporting custom argument and result types
- Configurable required parameters
- Standardizes common API function patterns
- Ensures consistent error handling across all APIs

## 5. API Functions

### 5.1 show (`src/api/show.ts`)

**Purpose**: Shows various types of Git objects (commits, trees, blobs, tags) in human-readable format

**Key Features**:
- Similar to `git show` command
- Supports showing objects by ref or OID
- Optional filepath parameter to show specific files from trees
- Returns typed results: `ShowResult` with `oid`, `type`, `object`, and optional `filepath`

**Implementation Details**:
- Uses `RefManager.resolve()` to resolve refs to OIDs
- Falls back to treating ref as OID if resolution fails (for 40-char hex strings)
- Uses core-utils parsers: `parseCommit()`, `parseTree()`, `parseBlob()`, `parseTag()`
- Supports Repository parameter for unified API access
- Handles all Git object types with appropriate parsing

### 5.2 merge (`src/api/merge.ts`)

**Purpose**: Merges two branches together

**Key Features**:
- Supports fast-forward and merge commits
- Options: `fastForward`, `fastForwardOnly`, `dryRun`, `noUpdateBranch`, `abortOnConflict`, `allowUnrelatedHistories`
- Handles author and committer normalization
- Supports commit signing with `onSign` callback
- Custom merge commit messages

**Implementation Details**:
- Wraps `_merge()` command function
- Validates required parameters (fs, author, committer)
- Uses `normalizeAuthorObject()` and `normalizeCommitterObject()` utilities
- Throws `MissingNameError` if author/committer not provided when needed
- Returns `MergeResult` type with merge status and conflicts

## 6. Core Repository Class

### 6.1 Repository (`src/core-utils/Repository.ts`)

**Purpose**: Central representation of a Git repository providing unified access to all low-level managers

**Key Features**:
- Static factory method: `Repository.open()` - Opens repository from directory (handles bare and non-bare repos)
- Lazy-loaded managers: Config, StateManager, RefManager, ObjectReader, ObjectWriter, Index
- Properties: `fs`, `dir`, `gitdir`, `cache`
- Methods: `getConfig()`, `getStateManager()`, `getRefManager()`, `getObjectReader()`, `getObjectWriter()`, `getIndex()`, `writeIndex()`, `resolveRef()`, `listRefs()`, `writeRef()`, `invalidateCache()`
- Auto-detects bare repositories
- Supports system, global, and local config paths

**Implementation Details**:
- Uses `_findRoot()` to locate `.git` directory
- Lazy initialization of managers for performance
- Caches parsed index and config
- Provides unified API for repository operations
- Handles both bare and non-bare repository formats
- Integrates with all core-utils modules

## 7. Multi-Pack Index (MIDX) Support

### 7.1 GitMultiPackIndex Model (`src/models/GitMultiPackIndex.ts`)

**Purpose**: Parses and provides lookups for Git's multi-pack-index format

**Key Features**:
- Static factory: `fromBuffer()` - Parses MIDX binary format
- Methods: `lookup()`, `getPackfileName()`, `getPackfileNames()`, `getObjectCount()`, `getVersion()`
- Efficient OID lookups across multiple packfiles using fanout table and binary search
- Supports large offsets (64-bit) for packfiles > 4GB
- Optional object type caching

**Implementation Details**:
- Parses MIDX version 1 format with SHA-1 object IDs
- Handles chunk-based format: PNAM (packfile names), OIDF (OID fanout), OIDL (OID lookup), OOFF (object offsets), LOFF (large offsets), TYPE (object types)
- Uses binary search within fanout ranges for O(log n) lookups
- Verifies checksum (SHA-1)
- Handles large offsets using 64-bit integers for packfiles exceeding 4GB

### 7.2 MultiPackIndexWriter (`src/core-utils/odb/MultiPackIndexWriter.ts`)

**Purpose**: Writes multi-pack-index files by scanning all packfiles

**Key Features**:
- Function: `writeMultiPackIndex()` - Creates MIDX file from packfiles
- Scans all packfiles in `objects/pack/` directory
- Combines OIDs from multiple packfiles into single index
- Handles large offsets (> 4GB) with separate chunk
- Supports progress callbacks

**Implementation Details**:
- Reads all packfile indices to collect OIDs
- Sorts OIDs for efficient fanout table generation
- Writes chunks in MIDX format specification
- Computes and appends SHA-1 checksum
- Handles external ref deltas for complete object tracking

### 7.3 PackfileReader MIDX Integration (`src/core-utils/odb/PackfileReader.ts`)

**Purpose**: Integrates MIDX support into packfile reading

**Key Features**:
- Function: `loadMultiPackIndex()` - Loads MIDX from disk or cache
- Caches MIDX instance for performance
- Falls back to individual packfile indices if MIDX doesn't exist
- Uses MIDX for OID lookups when available

**Implementation Details**:
- Reads MIDX from `objects/info/multi-pack-index`
- Caches parsed MIDX to avoid re-parsing
- Gracefully handles missing MIDX files
- Provides efficient lookup path for objects across multiple packfiles

## 8. Cherry-Pick Implementation

### 8.1 cherryPick API (`src/api/cherryPick.ts`)

**Purpose**: Applies changes from existing commits to current branch

**Key Features**:
- Similar to `git cherry-pick` command
- Parameters: `commit` (ref or OID), `noCommit` (stage changes without committing)
- Performs three-way merge using commit's parent as base
- Handles conflicts with `CHERRY_PICK_HEAD` state file
- Creates new commit preserving original author/committer

**Implementation Details**:
- Resolves commit OID and reads commit object
- Gets current HEAD and commit's first parent
- Uses `mergeTrees()` for three-way merge
- Sets `CHERRY_PICK_HEAD` on conflicts
- Creates new commit with merged tree
- Updates HEAD to new commit
- Preserves original commit message and metadata

## 9. Core-Utils Implementations

### 9.1 Object Database (ODB) Utilities

#### 9.1.1 ObjectReader (`src/core-utils/odb/ObjectReader.ts`) ⚠️ DEPRECATED

**Status**: Deprecated - use `readObject` from `src/git/objects/readObject.ts` instead

**Purpose**: Reads Git objects from object database

**Features**: 
- Supports loose objects, packfiles, MIDX lookups
- Multiple formats: content, parsed, deflated, wrapped
- Handles all object types: commit, tree, blob, tag
- Efficient lookup across all storage backends

**Migration**: All direct usages have been migrated to `src/git/objects/readObject.ts`

#### 9.1.2 ObjectWriter (`src/core-utils/odb/ObjectWriter.ts`) ⚠️ DEPRECATED

**Status**: Deprecated - use `writeObject` from `src/git/objects/writeObject.ts` instead

**Purpose**: Writes Git objects to object database

**Features**: 
- Handles loose object storage
- Compression and format conversion
- Object type validation
- SHA-1 hash computation

**Migration**: All direct usages have been migrated to `src/git/objects/writeObject.ts`

#### 9.1.3 PackfileReader (`src/core-utils/odb/PackfileReader.ts`) ⚠️ DEPRECATED

**Status**: Deprecated - use `read`/`loadIndex` from `src/git/objects/pack.ts` instead

**Purpose**: Reads objects from packfiles

**Features**: 
- Delta resolution (OFS-delta and REF-delta)
- MIDX integration for multi-packfile lookups
- Packfile index caching
- Efficient object retrieval

**Migration**: Functionality migrated to `src/git/objects/pack.ts`

#### 9.1.4 PackfileWriter (`src/core-utils/odb/PackfileWriter.ts`)

**Purpose**: Writes objects to packfiles

**Features**: 
- Delta compression for space efficiency
- Packfile creation and management
- Index generation
- Progress tracking

#### 9.1.5 LooseObjectManager (`src/core-utils/odb/LooseObjectManager.ts`) ⚠️ DEPRECATED

**Status**: Deprecated - use `read`/`write` from `src/git/objects/loose.ts` instead

**Purpose**: Manages loose (unpacked) Git objects

**Features**: 
- Object storage in traditional Git directory structure
- Retrieval by OID
- Directory structure management (two-level sharding)
- Object existence checking

**Migration**: Functionality migrated to `src/git/objects/loose.ts`

#### 9.1.6 DeltaResolver (`src/core-utils/odb/DeltaResolver.ts`)

**Purpose**: Resolves delta-compressed objects

**Features**: 
- OFS-delta and REF-delta resolution
- Object reconstruction from deltas
- Chain delta resolution
- Efficient delta application

### 9.2 Reference Management

#### 9.2.1 RefManager (`src/core-utils/refs/RefManager.ts`)

**Purpose**: Manages Git references (branches, tags, etc.)

**Features**: 
- Read, write, delete refs
- Resolve refs to OIDs with depth control
- List refs matching prefixes
- Handle symbolic refs
- Update remote refs based on refspecs

#### 9.2.2 ReflogManager (`src/core-utils/refs/ReflogManager.ts`)

**Purpose**: Manages reference logs

**Features**: 
- Read/write reflog entries
- Track ref changes over time
- Parse reflog format
- Support for reflog expiration

#### 9.2.3 NotesManager (`src/core-utils/refs/NotesManager.ts`)

**Purpose**: Manages Git notes

**Features**: 
- Add, read, remove, list notes
- Notes reference management
- Notes tree traversal
- Support for multiple notes refs

#### 9.2.4 ShallowManager (`src/core-utils/refs/ShallowManager.ts`)

**Purpose**: Manages shallow clone information

**Features**: 
- Read/write shallow file
- Check if commit is shallow
- Manage shallow boundary commits
- Support for unshallow operations

#### 9.2.5 RefParser (`src/core-utils/refs/RefParser.ts`)

**Purpose**: Parses reference names and paths

**Features**: 
- Validates ref names according to Git rules
- Parses ref paths
- Handles special refs (HEAD, FETCH_HEAD, etc.)
- Ref name normalization

### 9.3 Parsers

#### 9.3.1 Commit Parser (`src/core-utils/parsers/Commit.ts`)

**Purpose**: Parses and serializes commit objects

**Features**: 
- `parse()` function for reading commit objects
- `serialize()` function for writing commit objects
- Handles commit metadata (author, committer, message, tree, parents)
- Supports GPG signatures
- Handles commit encoding

#### 9.3.2 Tree Parser (`src/core-utils/parsers/Tree.ts`)

**Purpose**: Parses and serializes tree objects

**Features**: 
- `parse()` function for reading tree objects
- `serialize()` function for writing tree objects
- Handles tree entries with modes and OIDs
- Supports all entry types (blob, tree, commit, etc.)

#### 9.3.3 Blob Parser (`src/core-utils/parsers/Blob.ts`)

**Purpose**: Parses and serializes blob objects

**Features**: 
- `parse()` function for reading blob objects
- `serialize()` function for writing blob objects
- Handles blob content as binary data
- No transformation of blob content

#### 9.3.4 Tag Parser (`src/core-utils/parsers/Tag.ts`)

**Purpose**: Parses and serializes tag objects

**Features**: 
- `parse()` function for reading tag objects
- `serialize()` function for writing tag objects
- Handles annotated tags with metadata
- Supports GPG signatures
- Handles tag message and encoding

### 9.4 Algorithms

#### 9.4.1 MergeManager (`src/core-utils/algorithms/MergeManager.ts`)

**Purpose**: Handles three-way tree merging

**Features**: 
- `mergeTrees()` function for three-way merges
- Conflict detection and reporting
- Automatic merging of non-conflicting changes
- Handles file additions, deletions, and modifications
- Supports merge strategies

#### 9.4.2 CommitGraphWalker (`src/core-utils/algorithms/CommitGraphWalker.ts`)

**Purpose**: Walks commit graph

**Features**: 
- Traverses commit history
- Finds merge bases between commits
- Handles commit relationships (parents, children)
- Supports various traversal strategies
- Efficient graph algorithms

#### 9.4.3 SequencerManager (`src/core-utils/algorithms/SequencerManager.ts`)

**Purpose**: Manages rebase and cherry-pick sequencer operations

**Features**: 
- Rebase state management
- Sequencer file handling
- Command execution (pick, edit, drop, etc.)
- Interactive rebase support
- Sequencer state persistence

### 9.5 Filesystem Utilities

#### 9.5.1 WorkdirManager (`src/core-utils/filesystem/WorkdirManager.ts`)

**Purpose**: Manages working directory operations

**Features**: 
- File operations (read, write, delete)
- Checkout operations
- Status tracking
- Working directory state management
- File mode handling

#### 9.5.2 SparseCheckoutManager (`src/core-utils/filesystem/SparseCheckoutManager.ts`)

**Purpose**: Manages sparse checkout configuration

**Features**: 
- Sparse checkout patterns
- File filtering based on patterns
- Cone and non-cone mode support
- Pattern parsing and evaluation

#### 9.5.3 SubmoduleManager (`src/core-utils/filesystem/SubmoduleManager.ts`)

**Purpose**: Manages Git submodules

**Features**: 
- Submodule initialization
- Submodule update operations
- Submodule configuration
- Submodule URL and path management
- .gitmodules file parsing

#### 9.5.4 IgnoreManager (`src/core-utils/filesystem/IgnoreManager.ts`)

**Purpose**: Manages .gitignore file parsing

**Features**: 
- Pattern matching
- Ignore rule evaluation
- Multiple .gitignore file support
- Pattern negation support
- Directory vs file pattern handling

#### 9.5.5 GitAttributesParser (`src/core-utils/filesystem/GitAttributesParser.ts`)

**Purpose**: Parses .gitattributes files

**Features**: 
- Attribute rule parsing
- Line ending handling (eol, text, binary attributes)
- Merge and diff attributes
- Filter and clean attributes
- Pattern matching for attributes

#### 9.5.6 LineEndingFilter (`src/core-utils/filesystem/LineEndingFilter.ts`)

**Purpose**: Handles line ending conversions

**Features**: 
- CRLF/LF conversion based on gitattributes
- Auto-detection of line endings
- Text attribute handling
- EOL normalization

### 9.6 Configuration and State

#### 9.6.1 UnifiedConfigService (`src/core-utils/UnifiedConfigService.ts`)

**Purpose**: Unified configuration service combining system, global, and local configs

**Features**: 
- Config merging from multiple sources
- Scope management (system, global, local)
- Value resolution with precedence
- Config file reading and writing
- Subsection support

#### 9.6.2 StateManager (`src/core-utils/StateManager.ts`)

**Purpose**: Manages repository state files (MERGE_HEAD, CHERRY_PICK_HEAD, etc.)

**Features**: 
- Read/write state files
- Check operation status (merge, cherry-pick, rebase)
- Manage ORIG_HEAD
- State file cleanup
- Operation state tracking

#### 9.6.3 ConfigParser (`src/core-utils/ConfigParser.ts`)

**Purpose**: Parses Git configuration files

**Features**: 
- Section/variable parsing
- Value type conversion
- Subsection handling
- Comment and quote handling
- Config file format validation

### 9.7 Index Management

#### 9.7.1 Index Operations (`src/git/index/`) ✅ MIGRATED

**Purpose**: Direct operations on `.git/index` file

**Status**: ✅ **Migrated to `src/git/index/` structure**

**Files**:
- `readIndex.ts` - Read from `.git/index`
- `writeIndex.ts` - Write to `.git/index`
- `GitIndex.ts` - Index model/parser (moved from `src/models/`)

**Features**: 
- Index entry parsing
- Conflict resolution tracking
- Index serialization
- Extended index format support
- Index version handling
- Direct file operations (no intermediate caching layers)

**Legacy Locations** (removed):
- `src/core-utils/index/Index.ts` - Legacy index parser (✅ removed - all usages migrated)
- `src/models/GitIndex.ts` - Index model (✅ moved to `src/git/index/GitIndex.ts`)

### 9.8 Network and Protocol

#### 9.8.1 SmartProtocolManager (`src/core-utils/network/SmartProtocolManager.ts`)

**Purpose**: Manages Git smart HTTP protocol

**Features**: 
- Protocol negotiation
- Capability handling
- Upload-pack and receive-pack support
- Protocol version management
- Authentication integration

#### 9.8.2 PktLine (`src/core-utils/network/PktLine.ts`)

**Purpose**: Handles packet-line protocol for network operations

**Features**: 
- Pkt-line encoding/decoding
- Stream handling
- Flush and delimiter packet support
- Binary data handling
- Protocol compliance

### 9.9 Other Utilities

#### 9.9.1 GitPath (`src/core-utils/GitPath.ts`)

**Purpose**: Path manipulation utilities

**Features**: 
- Join, normalize, resolve Git paths
- Path validation
- Cross-platform path handling
- Relative path resolution

#### 9.9.2 ShaHasher (`src/core-utils/ShaHasher.ts`)

**Purpose**: SHA-1 hashing utilities

**Features**: 
- Object hashing
- Checksum computation
- Hash verification
- Efficient hashing operations

#### 9.9.3 Signing (`src/core-utils/Signing.ts`)

**Purpose**: Commit and tag signing

**Features**: 
- GPG signing integration
- Signature verification
- Signing key management
- Signature format handling

#### 9.9.4 Zlib (`src/core-utils/Zlib.ts`)

**Purpose**: Compression/decompression utilities

**Features**: 
- Zlib compression for Git objects
- Decompression of packed objects
- Stream compression/decompression
- Error handling for corrupted data

## Migration to `src/git/` Structure

### Completed Migrations

#### Index Operations ✅
- **Location**: `src/git/index/`
- **Files**: 
  - `readIndex.ts` - Read from `.git/index`
  - `writeIndex.ts` - Write to `.git/index`
  - `GitIndex.ts` - Index model (moved from `src/models/`)
- **Status**: Fully migrated, Repository methods updated
- **Note**: Legacy `src/core-utils/index/Index.ts` removed - all usages migrated to `GitIndex`

#### Refs Operations ✅ (Partial)
- **Location**: `src/git/refs/`
- **Files**: 
  - `readRef.ts` - Read refs from `.git/refs/`
  - `writeRef.ts` - Write refs to `.git/refs/`
  - `listRefs.ts` - List refs matching patterns
  - `deleteRef.ts` - Delete refs
- **Status**: Core ref operations migrated, some managers still use old code

### Planned Migrations

#### Refs Operations ⏳ (Remaining)
- **Target Location**: `src/git/refs/` and `src/git/logs/`
- **Current Location**: `src/core-utils/refs/`
- **Files to Migrate**:
  - `ReflogManager.ts` → `src/git/logs/readLog.ts`, `writeLog.ts`
  - `ShallowManager.ts` → `src/git/shallow.ts`
  - `NotesManager.ts` → `src/git/refs/notes/`
- **Status**: Core ref operations complete, remaining are specialized managers

#### Object Database ✅ (Core Functions Migrated)
- **Target Location**: `src/git/objects/`
- **Current Location**: `src/core-utils/odb/`
- **Files Migrated**:
  - ✅ `LooseObjectManager.ts` → `src/git/objects/loose.ts`
  - ✅ `PackfileReader.ts` → `src/git/objects/pack.ts`
  - ✅ `ObjectReader.ts` → `src/git/objects/readObject.ts` (deprecated)
  - ✅ `ObjectWriter.ts` → `src/git/objects/writeObject.ts` (deprecated)
- **Files Remaining**:
  - ⏳ `PackfileWriter.ts` → `src/git/objects/pack/writePack.ts` (if needed)
  - ⏳ `MultiPackIndexWriter.ts` → `src/git/objects/info/multi-pack-index.ts` (if needed)

#### Configuration ✅
- **Target Location**: `src/git/config.ts`
- **Current Location**: `src/core-utils/UnifiedConfigService.ts`, `src/managers/GitConfigManager.ts`
- **Status**: ✅ Migrated - Config functions created in `src/git/config.ts`
- **Migration**: `GitConfigManager` now delegates to new functions

#### State Files ⏳
- **Target Location**: `src/git/state/`
- **Current Location**: `src/core-utils/StateManager.ts`
- **Files to Create**:
  - `MERGE_HEAD.ts`, `CHERRY_PICK_HEAD.ts`, `ORIG_HEAD.ts`, etc.

## Cleanup and Deprecation Status

### Deprecated Components

#### StagingArea (`src/core-utils/StagingArea.ts`) ✅ REMOVED
- **Status**: Removed - migration complete
- **Replacement**: Use `Repository.readIndexDirect()` and `Repository.writeIndexDirect()` directly
- **Migration**: All usages migrated, `Worktree` is now stateless and delegates to `Repository`
- **See**: [CLEANUP_PLAN.md](./CLEANUP_PLAN.md) Phase 2

#### Legacy Index Parser (`src/core-utils/index/Index.ts`) ✅ REMOVED
- **Status**: Removed - migration complete
- **Replacement**: Use `GitIndex` from `src/git/index/GitIndex.ts`
- **Migration**: All usages migrated to `GitIndex.fromBuffer()` and `GitIndex.toBuffer()`
- **See**: [CLEANUP_PLAN.md](./CLEANUP_PLAN.md) Phase 1

#### Manager Classes (`src/managers/`) ⚠️ UNDER REVIEW
- **Status**: Most managers have been migrated to `src/git/` structure
- **Classes**:
  - `GitConfigManager` - ✅ **DEPRECATED** - Delegates to `src/git/config.ts` functions
  - `GitIgnoreManager` - ✅ **DEPRECATED** - Delegates to `src/git/info/isIgnored.ts` function
  - `GitShallowManager` - ✅ **DEPRECATED** - Delegates to `src/git/shallow.ts` functions
  - `GitRemoteManager` - ✅ **DEPRECATED** - Delegates to `src/git/remote/getRemoteHelper.ts` function
  - `GitStashManager` - ✅ **DEPRECATED** - Delegates to `src/git/refs/stash.ts` functions
- **See**: [CLEANUP_PLAN.md](./CLEANUP_PLAN.md) Phase 3/4

### Cleanup Plan

A comprehensive cleanup plan has been created to guide the removal of legacy code and elimination of duplication. See [CLEANUP_PLAN.md](./CLEANUP_PLAN.md) for detailed phases and action items.

**Key Cleanup Areas**:
1. Legacy index parser migration
2. Deprecated StagingArea removal
3. Manager classes assessment and migration
4. Storage directory consolidation
5. Duplicate code elimination
6. API layer cleanup (per PLAN_GEMINI_3.md)

## Summary

These implementations represent a significant enhancement to the isomorphic-git codebase, providing:

1. **Better Configuration Management**: GitConfig model, GitConfigManager, UnifiedConfigService, and ConfigAccess for robust config file handling
2. **Protocol Support**: GitPktLine for Git wire protocol packet handling
3. **File Ignore Logic**: GitIgnoreManager and IgnoreManager for comprehensive .gitignore support
4. **Error Handling**: New error types and factory functions for consistent error management
5. **Code Standardization**: Utilities like normalizeFs, createApiWrapper for reducing redundancy
6. **Enhanced API**: New show, merge, and cherryPick functions expanding Git command coverage
7. **Developer Experience**: ConfigAccess utility and Repository class simplifying repository operations
8. **Performance**: MIDX support for efficient multi-packfile lookups
9. **Advanced Operations**: Cherry-pick implementation with conflict handling
10. **Core Infrastructure**: Comprehensive core-utils providing low-level Git operations, parsers, algorithms, and filesystem management
11. **Architecture Alignment**: Migration to `src/git/` structure matching `.git` directory organization

**Architecture Direction**: All new implementations and migrations follow the principle of organizing code to match the `.git` directory structure, making the codebase more intuitive and maintainable. The goal is to have a 1:1 mapping between `.git` directory contents and `src/git/` module organization.

All implementations follow TypeScript best practices, use proper error handling, and integrate with the existing codebase architecture while moving toward the new `.git`-aligned structure.

