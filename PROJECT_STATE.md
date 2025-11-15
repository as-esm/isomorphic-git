# Isomorphic-Git Project State and Plans

**Last Updated**: 2025-11-15  
**Status**: Active Development

## Executive Summary

This document consolidates all planning documents, implementation status, and architectural decisions for the isomorphic-git project. It replaces multiple scattered planning documents with a single source of truth.

## Current Project Status

### Test Status
- **Total Tests**: 572
- **Passing**: 484+ (improving)
- **Failing**: ~88 (decreasing)
- **Primary Focus**: Merge operations, checkout, stash, and index management

### Recent Progress
- ✅ Fixed index cache management issues (70+ tests improved)
- ✅ Fixed GitTree entry validation (stash operations improved)
- ✅ Fixed merge conflict detection and error throwing
- ✅ Fixed conflict marker writing to worktree
- ✅ Implemented sparse checkout cone mode with negative patterns
- ✅ Fixed writeTreeChanges test issues (9/12 passing)

## Architecture Overview

### Current Structure
The codebase follows a layered architecture:
- **API Layer** (`src/api/`): Public-facing functions
- **Commands Layer** (`src/commands/`): Core command implementations
- **Core Utils** (`src/core-utils/`): Low-level Git operations
- **Managers** (`src/managers/`): High-level abstractions
- **Models** (`src/models/`): Data structures and parsers

### Proposed Refactoring: Match `.git` Directory Structure

**Goal**: Restructure code to match the actual `.git` directory structure for better maintainability and intuitive navigation.

**Status**: Planning phase - initial structure created

**Proposed Structure**:
```
src/
├── git/                          # Direct .git directory operations
│   ├── HEAD.ts                  # HEAD file operations
│   ├── config.ts                # Config file operations
│   ├── index/                   # Index (staging area)
│   │   ├── GitIndex.ts         # Index model
│   │   ├── readIndex.ts        # Read from .git/index
│   │   └── writeIndex.ts       # Write to .git/index
│   ├── objects/                # Object database
│   │   ├── loose/              # Loose objects
│   │   ├── pack/               # Packfiles
│   │   └── info/               # ODB metadata
│   ├── refs/                   # References
│   │   ├── heads/              # Local branches
│   │   ├── tags/               # Tags
│   │   └── remotes/            # Remote-tracking branches
│   ├── logs/                   # Reflogs
│   ├── info/                   # Local overrides
│   ├── hooks/                  # Git hooks
│   ├── state/                  # Temporary state files
│   └── worktrees/              # Linked worktrees
├── commands/                    # High-level Git commands
└── api/                        # Public API
```

**Benefits**:
1. Intuitive: Code structure matches `.git` structure
2. Easy to find: Want to work with index? Look in `src/git/index/`
3. Single source of truth: `.git/index` file is the source of truth
4. Less abstraction: Direct file operations, less indirection
5. Easier debugging: Can trace code to specific `.git` files

**Migration Status**:
- ✅ Phase 1: Index operations migrated to `src/git/index/`
- ⏳ Phase 2: Refs operations (in progress)
- ⏳ Phase 3: Object database (planned)
- ⏳ Phase 4: Other operations (planned)
- ⏳ Phase 5: Cleanup old managers (planned)

## Key Issues and Fixes

### 1. Index Cache Management ✅ FIXED

**Problem**: Index cache not properly populated after reading from disk, causing "Index not found in cache" errors.

**Solution**: 
- Fixed `updateCachedIndexFile()` to store empty index in cache
- Fixed `acquire()` to store empty index with proper stats
- Ensured cache synchronization between operations

**Impact**: 70+ tests improved, status tests from 0/5 to 2/5 passing

### 2. Merge Conflict Detection ✅ FIXED

**Problem**: Merge command not detecting conflicts properly or throwing wrong error types.

**Solution**:
- Fixed parameter name mismatch in `merge.ts` (base/ours/theirs → baseOid/ourOid/theirOid)
- Fixed conflict detection logic
- Ensured `MergeConflictError` is properly thrown
- Fixed conflict marker writing to worktree

**Impact**: Merge and abortMerge tests significantly improved

### 3. Checkout and Stash Restoration ⏳ IN PROGRESS

**Problem**: Files not being restored to HEAD after stash operations.

**Root Causes Identified**:
- Checkout operations bypassing Repository, causing cache/index sync issues
- `analyzeCheckout` may not detect index/workdir mismatches correctly
- Index OID extraction issues

**Proposed Solutions**:
- Add `Repository.checkout()` and `Repository.analyzeCheckout()` methods
- Update stash.ts to use Repository.checkout()
- Ensure index is synchronized before checkout
- Fix index OID extraction logic

**Status**: Investigation complete, implementation in progress

### 4. Test Infrastructure Improvements ✅ COMPLETE

**Improvements**:
- Created `tests/helpers/nativeGit.ts` for on-demand fixture generation
- Refactored 13+ merge tests to use native git
- Added config verification to all refactored tests
- Improved test isolation and reliability

### 5. Sparse Checkout Implementation ✅ COMPLETE

**Features Implemented**:
- Cone mode pattern matching
- Non-cone mode support
- Negative patterns (`!` prefix) for exclusions
- Configuration management (`core.sparseCheckout`, `core.sparseCheckoutCone`)
- Comprehensive test coverage

**Status**: Feature complete, all tests passing

## Implementation Plans

### Plan 1: Repository Centralization

**Goal**: Make Repository the single entry point for all Git operations.

**Status**: Partially implemented

**Completed**:
- Repository class provides unified access to managers
- Repository methods for merge, abortMerge, staging area, worktree

**In Progress**:
- Add `Repository.checkout()` method
- Add `Repository.analyzeCheckout()` method
- Update all checkout operations to use Repository

**Benefits**:
- Consistent cache usage
- Consistent gitdir resolution
- Centralized state management
- Better error handling

### Plan 2: FsClient/FileSystem Standardization

**Goal**: Standardize use of `FsClient` and `FileSystem` types across codebase.

**Status**: Planning phase

**Issues**:
- 50+ instances of `new FileSystem(fs)` scattered across codebase
- Inconsistent type annotations
- JSDoc comments don't match actual parameter types
- Redundant wrapping when `FileSystem` instance is already wrapped

**Proposed Solution**:
- Create `normalizeFs()` utility function
- Replace all `new FileSystem(fs)` calls with `normalizeFs(fs)`
- Update all type annotations and JSDoc comments
- Ensure all APIs accept `FsClient` (user-facing)

**Files Affected**: 87+ API files

### Plan 3: Simplify to Single Source of Truth

**Goal**: Eliminate cache synchronization issues by using `.git` directory as single source of truth.

**Principles**:
- The `.git` directory is the single source of truth
- All operations read/write directly to it
- Cache is optional and only for performance
- Simple cache at Repository level with TTL/invalidation

**Implementation**:
- Repository reads/writes index directly to `.git/index`
- No intermediate caches that can get out of sync
- Simple cache based on file mtime
- Eliminate StateMutationStream complexity

**Status**: Partially implemented (index operations), ongoing

## New Implementations

### Completed Features

1. **GitConfig Model** (`src/models/GitConfig.ts`)
   - Parses and manages Git configuration files
   - Supports schema-based type conversion
   - Handles comments, quotes, and escaping

2. **Multi-Pack Index (MIDX) Support**
   - `GitMultiPackIndex` model for parsing MIDX format
   - `MultiPackIndexWriter` for creating MIDX files
   - PackfileReader MIDX integration

3. **Cherry-Pick Implementation**
   - `cherryPick` API function
   - Three-way merge using commit's parent as base
   - Conflict handling with `CHERRY_PICK_HEAD` state file

4. **Sparse Checkout Cone Mode**
   - Directory-based pattern matching
   - Negative patterns for exclusions
   - Configuration management

5. **Repository Class**
   - Central representation of Git repository
   - Unified access to all low-level managers
   - Lazy-loaded managers for performance

### In Progress

1. **Checkout Centralization**
   - Adding Repository.checkout() method
   - Updating all checkout operations

2. **Index Migration**
   - Moving index operations to `src/git/index/`
   - Updating commands to use new structure

## Test Status by Category

### Passing Test Suites
- ✅ Sparse checkout tests
- ✅ Most merge edge case tests (17/17)
- ✅ Most writeTreeChanges tests (9/12)
- ✅ Status tests (improved from 0/5 to 2/5)
- ✅ Stash tests (improved from 0/15 to 5/15)

### Failing Test Suites
- ⏳ Some merge tests (conflict detection edge cases)
- ⏳ Some abortMerge tests (error type mismatches)
- ⏳ Some checkout tests (file restoration)
- ⏳ Some stash tests (restoration after stash)

## Next Steps

### Immediate (This Week)
1. Complete Repository.checkout() implementation
2. Fix remaining checkout/stash restoration issues
3. Continue test refactoring to use native git

### Short-term (This Month)
1. Complete index migration to `src/git/index/`
2. Begin refs operations migration
3. Fix remaining test failures
4. Standardize FsClient/FileSystem usage

### Medium-term (Next Quarter)
1. Complete migration to `.git` directory structure
2. Remove old manager complexity
3. Improve test coverage
4. Performance optimizations

## Documentation Files

### Consolidated Documents
This document replaces the following planning documents:
- `PROGRESS_SUMMARY.md` - Test fix progress
- `MIGRATION_PLAN.md` - Structure migration plan
- `GIT_STRUCTURE_MAPPING.md` - Code to .git mapping
- `REFACTOR_IMPLEMENTATION.md` - Refactoring implementation
- `REFACTOR_PROPOSAL.md` - Refactoring proposal
- `PLAN_FIX_TESTS.md` - Test fix plan
- `CHECKOUT_CALL_ANALYSIS.md` - Checkout analysis
- `CHECKOUT_FIX_PLAN.md` - Checkout fix plan
- `PLAN_FIX_ABORT_MERGE.md` - AbortMerge fix plan
- `MERGE_FIX_PLAN.md` - Merge fix plan
- `PLAN_REFACTOR_AND_FIX_MERGE.md` - Merge refactor plan
- `PLAN_FIX_MERGE_ABORT_MERGE.md` - Merge/abortMerge fix plan
- `SPARSE_CHECKOUT_IMPLEMENTATION.md` - Sparse checkout docs
- `PLAN_FsClient_FileSystem_Standardization.md` - FsClient standardization

### Reference Documents
- `NEW_IMPLEMENTATIONS.md` - Detailed implementation documentation
- `README.md` - Project overview and getting started

## Contributing

The project is community-driven. If you want a feature implemented, you need to:
1. Implement it yourself, or
2. Find someone willing to write the code

The project has some funding on [OpenCollective](https://opencollective.com/isomorphic-git) that can be used for development, but resources are limited.

## Maintenance

**Current Maintainers**:
- [@jcubic](https://github.com/jcubic) (most active)
- [@mojavelinux](https://github.com/mojavelinux)

They primarily do code review and answer issues. The project is community-driven.

---

**Note**: This document should be updated as work progresses. Old planning documents can be archived but should be kept for historical reference.

