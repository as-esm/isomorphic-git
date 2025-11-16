# Test Coverage Improvement Plan

**Current Coverage Status:**
- Statements: 63.99% (23,657/36,967)
- Branches: 71.79% (2,848/3,967)
- Functions: 62.08% (673/1,084)
- Lines: 63.99% (23,657/36,967)

**Target Goals:**
- Statements: 80%+
- Branches: 80%+
- Functions: 75%+
- Lines: 80%+

**Important Testing Infrastructure Notes:**
- **Test Runner**: The project uses **Node.js native test runner** (`node --test`) with TypeScript support via `--experimental-strip-types`
- **Test Location**: Tests should be in `tests/` directory with `.test.ts` extension
- **Legacy Tests**: The `__tests__/` directory is a leftover from before migration (previously used Jest/jasmine). These tests need to be ported to the new structure.
- **Test Format**: Tests use Node.js native test API (`test()`, `t.test()`, `assert`) - NOT Jest/jasmine syntax
- **Fixture Helper**: Use `makeFixture()` from `tests/helpers/fixture.ts` for test fixtures

---

## Phase 1: Critical Zero Coverage Files (Priority: HIGH)

These files have 0% coverage and should be addressed first if they're actively used:

### 1.1 Core Utilities - Zero Coverage
- **`src/core-utils/index/Index.ts`** (0% - 315 lines)
  - Status: Legacy/deprecated (see CLEANUP_PLAN.md)
  - Action: Verify if still needed, or mark for removal
  - Priority: LOW (deprecated)

- **`src/core-utils/network/`** (0% - 172 lines)
  - Files: `PktLine.ts`, `SmartProtocolManager.ts`
  - Action: Add integration tests for network protocol handling
  - Priority: MEDIUM (used in fetch/push operations)

- **`src/http/web/`** (0% - 47 lines)
  - Action: Add browser-specific HTTP tests
  - Priority: MEDIUM (browser compatibility)

### 1.2 Models - Zero Coverage
  - **`src/models/RunningMinimum.ts`** (0% - 23 lines)
  - Status: ✅ **IMPROVED** - Created `tests/models/RunningMinimum.test.ts` with 12 test cases covering initial state, consider operations, reset, null/undefined handling, and different value types

- **`src/core-utils/filesystem/LineEndingFilter.ts`** (0% - 80 lines)
  - Status: ✅ **IMPROVED** - Created `tests/core-utils/filesystem/LineEndingFilter.test.ts` with 22 test cases covering lf, crlf, auto, binary modes, unicode, and edge cases

- **`src/core-utils/filesystem/GitAttributesParser.ts`** (0% - 140 lines)
  - Status: ✅ **IMPROVED** - Created `tests/core-utils/filesystem/GitAttributesParser.test.ts` with 18 test cases covering parsing, loading, nested paths, and fixed pattern matching bug

- **`src/models/Walker.ts`** (0% - 46 lines)
  - Status: Type definitions only (no runtime code to test)
  - Priority: LOW (types don't need coverage)

- **`src/models/index.ts`** (0% - 33 lines)
  - Action: Add tests for model exports
  - Priority: LOW (likely just exports)

### 1.3 Algorithms - Zero Coverage
- **`src/core-utils/algorithms/MergeManager.ts`** (0% - 271 lines)
  - Action: Add comprehensive merge algorithm tests
  - Priority: HIGH (critical for merge operations)

---

## Phase 2: Low Coverage API Functions (Priority: HIGH)

These API functions have low coverage and are user-facing:

### 2.1 Very Low Coverage (< 30%)
- **`src/api/push.ts`** (11% - 121 lines, 51 covered)
  - Action: Add tests for push operations, error cases, authentication
  - Priority: HIGH
  - Status: ⏳ Not started

- **`src/api/uploadPack.ts`** (11.86% - 59 lines)
  - Action: Add tests for upload pack protocol
  - Priority: MEDIUM
  - Status: ⏳ Not started

- **`src/api/getConfig.ts`** (0% - 22 lines)
  - Action: Add tests for config reading
  - Priority: HIGH
  - Status: ✅ **IMPROVED** - Enhanced `tests/config/config.test.ts` with 9 additional test cases covering dir parameter, non-existent values, branch configs, patterns, cache usage

- **`src/api/getConfigAll.ts`** (0% - 23 lines)
  - Action: Add tests for reading all config
  - Priority: HIGH
  - Status: ✅ **IMPROVED** - Enhanced `tests/config/config.test.ts` with test cases for multi-valued configs, patterns, single-valued configs returning arrays

- **`src/api/isDescendent.ts`** (15.58% - 63 lines, 28 covered)
  - Action: Add tests for descendent checking logic
  - Priority: MEDIUM
  - Status: ✅ **IMPROVED** - Created `tests/commands/isDescendent.test.ts` with 22 test cases covering direct parent relationships, grandparent relationships, multi-level ancestors, sibling commits, unrelated commits, same commit edge case, cache parameter, depth limits, error handling (missing parameters, invalid OIDs), reverse relationships, and merge commits

- **`src/api/listCommitsAndTags.ts`** (24.69% - 81 lines, 20 covered)
  - Action: Add tests for commit/tag listing
  - Priority: MEDIUM
  - Status: ✅ **IMPROVED** - Created `tests/commands/listCommitsAndTags.test.ts` with 8 test cases covering single/multiple start refs, finish refs, annotated tags, shallow commits, and edge cases

- **`src/api/listObjects.ts`** (25.75% - 66 lines)
  - Action: Add tests for object listing
  - Priority: MEDIUM

- **`src/api/pack.ts`** (24.67% - 77 lines)
  - Action: Add tests for pack operations
  - Priority: MEDIUM

- **`src/api/pull.ts`** (31.28% - 163 lines, 70 covered)
  - Action: Add tests for pull operations, merge scenarios
  - Priority: HIGH
  - Status: ⏳ Not started

- **`src/api/indexPack.ts`** (22.22% - 70 lines, 37 covered)
  - Action: Add tests for pack indexing
  - Priority: MEDIUM
  - Status: ⏳ Not started

- **`src/api/expandOid.ts`** (coverage unknown, but low)
  - Action: Add tests for OID expansion
  - Priority: MEDIUM
  - Status: ✅ **IMPROVED** - Enhanced `tests/refs/expandOid.test.ts` with 5 additional test cases covering dir parameter, longer prefix, full OID, minimum prefix, cache usage

- **`src/api/hashBlob.ts`** (coverage unknown, but low)
  - Action: Add tests for blob hashing
  - Priority: MEDIUM
  - Status: ✅ **IMPROVED** - Enhanced `tests/utils/hashBlob.test.ts` with 8 additional test cases covering empty string, multiline, binary data, unicode, large strings, consistency, wrapped format validation

### 2.2 Medium-Low Coverage (30-50%)
- **`src/api/fetch.ts`** (79.08% statements, but 59.75% branches)
  - Action: Add tests for edge cases, error paths
  - Priority: MEDIUM

- **`src/api/expandRef.ts`** (31.03% - 87 lines, 27 covered)
  - Action: Add tests for ref expansion
  - Priority: MEDIUM

- **`src/api/fastForward.ts`** (40.15% - 127 lines, 51 covered)
  - Action: Add tests for fast-forward scenarios
  - Priority: MEDIUM

- **`src/api/resetIndex.ts`** (22.83% - 127 lines, 29 covered)
  - Action: Add tests for index reset operations
  - Priority: MEDIUM

---

## Phase 3: Core Utilities - Low Coverage (Priority: MEDIUM)

### 3.1 Storage Layer (Deprecated but still used)
- **`src/storage/`** (27.58% overall)
  - Status: Being migrated to `src/git/objects/` (see CLEANUP_PLAN.md)
  - Action: Focus on new implementations in `src/git/objects/`
  - Priority: LOW (deprecated)

### 3.2 Filesystem Utilities
- **`src/core-utils/filesystem/`** (61.5% overall)
  - **`GitAttributesParser.ts`** (0% - 140 lines)
    - Action: Add tests for gitattributes parsing
    - Priority: MEDIUM
  
  - **`LineEndingFilter.ts`** (0% - 80 lines)
    - Action: Add tests for line ending normalization
    - Priority: MEDIUM
  
  - **`SubmoduleManager.ts`** (0% - 210 lines)
    - Action: Add tests for submodule operations
    - Priority: LOW (if submodules are supported)

### 3.3 ODB (Object Database)
- **`src/core-utils/odb/`** (18.7% overall)
  - Status: Being migrated to `src/git/objects/`
  - **`DeltaResolver.ts`** (0% - 94 lines)
    - Status: ✅ **IMPROVED** - Created `tests/core-utils/odb/DeltaResolver.test.ts` with 14 test cases covering simple copy/insert operations, copy with offset, multiple operations, varint encoding, large sizes (0x10000 optimization), error handling, and edge cases
    - Priority: MEDIUM
  
  - **`PackfileReader.ts`** (19.92% - 256 lines)
    - Action: Add tests for packfile reading edge cases
    - Priority: MEDIUM

### 3.4 Parsers
- **`src/core-utils/parsers/`** (86.1% overall - good!)
  - Most parsers have good coverage
  - Focus on edge cases and error handling

### 3.5 Algorithms
- **`src/core-utils/algorithms/SequencerManager.ts`** (29.74%)
  - Action: Add tests for sequencer operations
  - Priority: MEDIUM
  - Status: ✅ **IMPROVED** - Created `tests/core-utils/algorithms/SequencerManager.test.ts` with 18 test cases covering getSequencerDir, isRebaseInProgress, readRebaseTodo, writeRebaseTodo, readRebaseHead, readRebaseOnto, initRebase, nextRebaseCommand, abortRebase, and completeRebase

---

## Phase 4: Error Handling & Edge Cases (Priority: MEDIUM)

### 4.1 Error Classes
- **`src/errors/BaseError.ts`** (26.19% - 79 lines)
  - Status: ✅ **IMPROVED** - Created `tests/errors/BaseError.test.ts` with 14 test cases covering constructor, serialization (toJSON/fromJSON), error chaining, and properties

- Several error classes have low coverage:
  - `CheckoutConflictError.ts` (43.75%)
    - Status: ✅ **IMPROVED** - Created `tests/errors/CheckoutConflictError.test.ts` with 5 test cases covering constructor, single/multiple filepaths, empty array, and error chaining
  - `CommitNotFetchedError.ts` (50%)
    - Status: ✅ **IMPROVED** - Created `tests/errors/CommitNotFetchedError.test.ts` with 4 test cases covering constructor, different ref formats, and error chaining
  - `PushRejectedError.ts` (41.17%)
    - Status: ✅ **IMPROVED** - Created `tests/errors/PushRejectedError.test.ts` with 4 test cases covering both reason types (not-fast-forward, tag-exists) and error chaining
  - `RemoteCapabilityError.ts` (38.88%)
    - Status: ✅ **IMPROVED** - Created `tests/errors/RemoteCapabilityError.test.ts` with 6 test cases covering all capability/parameter combinations and error chaining
  - Action: Add tests for error instantiation and properties
  - Priority: LOW (errors are important but less critical)

### 4.2 Utility Functions
Many utility functions have low coverage:
- **`src/utils/`** (72% overall)
  - **`DeepMap.ts`** (0% - 36 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/DeepMap.test.ts` with 13 test cases covering set, get, has, nested paths, edge cases
  - **`compare.ts`** (0% - 49 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/compare.test.ts` with 18 test cases covering compareStrings, comparePath, compareTreeEntryPath, compareRefNames, compareAge
  - **`compareAge.ts`** (0% - 5 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/compareAge.test.ts` with 4 test cases covering age comparison, same age, committer timestamp usage
  - **`compareRefNames.ts`** (0% - 10 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/compareRefNames.test.ts` with 10 test cases covering ref comparison, ^{} suffix handling, edge cases
  - **`errorFactory.ts`** (0% - 42 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/errorFactory.test.ts` with 9 test cases covering createErrorClass, createTypedErrorClass, error inheritance
  - **`fromEntries.ts`** (0% - 10 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/fromEntries.test.ts` with 6 test cases covering map to object conversion, edge cases
  - **`fromStream.ts`** (0% - 19 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/fromStream.test.ts` with 6 test cases covering ReadableStream to async iterator conversion, edge cases
  - **`normalizeIdentity.ts`** (0% - 51 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/normalizeIdentity.test.ts` with 8 test cases covering author/committer normalization, priority chains, config usage
  - **`resolveFileIdInTree.ts`** (0% - 96 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/resolveFileIdInTree.test.ts` with 11 test cases covering root files, nested directories, deeply nested structures, multiple matches, empty OID, fileId matching tree OID, and edge cases
  - **`fromValue.ts`** (0% - 17 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/fromValue.test.ts` with 6 test cases covering async iterator conversion, next/return methods, different value types, and for-await iteration
  - **`sleep.ts`** (0% - 3 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/sleep.test.ts` with 4 test cases covering timing behavior, zero delay, small delays, and chaining
  - **`outdent.ts`** (0% - 7 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/outdent.test.ts` with 7 test cases covering leading space removal, single/multiple spaces, mixed indentation, and edge cases
  - **`indent.ts`** (0% - 9 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/indent.test.ts` with 8 test cases covering space addition, trimming behavior, newline handling, and edge cases
  - **`toHex.ts`** (0% - 9 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/toHex.test.ts` with 7 test cases covering Buffer/Uint8Array/ArrayBuffer conversion, padding, and edge cases
  - **`padHex.ts`** (0% - 4 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/padHex.test.ts` with 8 test cases covering padding, zero handling, width matching, and error cases
  - **`basename.ts`** (0% - 7 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/basename.test.ts` with 9 test cases covering Unix/Windows paths, separators, edge cases
  - **`posixifyPathBuffer.ts`** (0% - 8 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/posixifyPathBuffer.test.ts` with 10 test cases covering backslash conversion, Buffer/Uint8Array handling, unicode, and edge cases
  - **`collect.ts`** (0% - 21 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/collect.test.ts` with 7 test cases covering async iterable collection, Buffer/Uint8Array handling, and edge cases
  - **`unionOfIterators.ts`** (0% - 61 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/unionOfIterators.test.ts` with 8 test cases covering iterator union, multiple sets, empty iterators, and edge cases
  - **`FIFO.ts`** (0% - 55 lines)
    - Status: ✅ **IMPROVED** - Created `tests/utils/FIFO.test.ts` with 9 test cases covering write/read operations, async reading, ending, error handling, and edge cases
  - Action: Add unit tests for remaining utility functions
  - Priority: MEDIUM

---

## Phase 5: Branch Coverage Improvement (Priority: MEDIUM)

Several files have good statement coverage but low branch coverage:

- **`src/api/merge.ts`** (88.82% statements, 48.07% branches)
  - Action: Add tests for all merge conflict scenarios
  - Priority: HIGH

- **`src/api/log.ts`** (77.61% statements, 58.33% branches)
  - Action: Add tests for different log query options
  - Priority: MEDIUM

- **`src/api/stash.ts`** (79.59% statements, 63.07% branches)
  - Action: Add tests for edge cases in stash operations
  - Priority: MEDIUM

- **`src/core-utils/MergeStream.ts`** (91.98% statements, 48.38% branches)
  - Action: Add tests for all stream event paths
  - Priority: MEDIUM

- **`src/core-utils/Repository.ts`** (73.01% statements, 73.45% branches)
  - Action: Add tests for repository edge cases
  - Priority: MEDIUM

---

## Phase 6: Commands Layer (Priority: MEDIUM)

The commands layer generally has good coverage, but some areas need attention:

- **`src/commands/`** - Most commands have 70%+ coverage
- Focus on:
  - Error paths
  - Edge cases
  - Integration scenarios

---

## Phase 7: Legacy Test Migration (Priority: HIGH)

**Goal**: Migrate all remaining legacy tests from `__tests__/` to `tests/` directory to ensure coverage works correctly and consolidate test suite into a single, modern structure.

**Problem**: 
- Coverage tool (c8) excludes `__tests__/**` from coverage
- Tests in `__tests__/` use Jest/jasmine syntax (incompatible with Node.js native test runner)
- Tests need to be in `tests/` directory with `.test.ts` extension for proper coverage tracking

**Solution**: 
- Migrate all legacy tests to `tests/` directory
- Convert Jest/jasmine syntax to Node.js native test runner syntax
- Update imports and fixture paths
- Remove `__tests__/` directory after migration

### Migration Status

#### ✅ Already Migrated (Removed from `__tests__/`)
- `test-readCommit.js` → `tests/commands/readCommit.test.ts` ✅
- `test-readBlob.js` → `tests/commands/readBlob.test.ts` ✅
- `test-updateIndex.js` → `tests/commands/updateIndex.test.ts` ✅
- `test-resetIndex.js` → `tests/commands/resetIndex.test.ts` ✅
- `test-remove.js` → `tests/commands/remove.test.ts` ✅
- `test-readTag.js` → `tests/commands/readTag.test.ts` ✅
- `test-readTree.js` → `tests/commands/readTree.test.ts` ✅
- `test-readObject.js` → `tests/commands/readObject.test.ts` ✅
- `test-add.js` → `tests/commands/add.test.ts` ✅
- `test-log.js` → `tests/commands/log.test.ts` ✅
- `test-log-file.js` → `tests/commands/log.test.ts` ✅
- `test-listBranches.js` → `tests/commands/listBranches.test.ts` ✅
- `test-listTags.js` → `tests/commands/listTags.test.ts` ✅
- `test-listRefs.js` → `tests/commands/listRefs.test.ts` ✅
- `test-listFiles.js` → `tests/commands/listFiles.test.ts` ✅
- `test-listCommitsAndTags.js` → `tests/commands/listCommitsAndTags.test.ts` ✅

#### ⏳ Remaining Tests to Migrate

**Priority 1: Command Tests (High Priority)**
1. ⏳ `__tests__/snapshot/test-listObjects.js` → `tests/commands/listObjects.test.ts`
   - Tests `listObjects` API function (25.75% coverage)
   - Priority: MEDIUM

**Priority 2: HTTP/Network Tests (High Priority)**
2. ⏳ `__tests__/http/test-fetch.js` → `tests/http/fetch.test.ts`
   - Tests fetch operations
   - Priority: HIGH
3. ⏳ `__tests__/http/test-pull.js` → `tests/http/pull.test.ts`
   - Tests pull operations (31.28% coverage - low coverage)
   - Priority: HIGH
4. ⏳ `__tests__/http/test-push.js` → `tests/http/push.test.ts`
   - Tests push operations (11% coverage - very low coverage)
   - Priority: HIGH
5. ⏳ `__tests__/http/test-listServerRefs.js` → `tests/http/listServerRefs.test.ts`
   - Tests server ref listing
   - Priority: MEDIUM
6. ⏳ `__tests__/http/test-getRemoteInfo.js` → `tests/http/getRemoteInfo.test.ts`
   - Tests remote info retrieval
   - Priority: MEDIUM
7. ⏳ `__tests__/http/test-getRemoteInfo2.js` → `tests/http/getRemoteInfo2.test.ts`
   - Tests remote info retrieval (alternative implementation)
   - Priority: MEDIUM
8. ⏳ `__tests__/http/test-hosting-providers.js` → `tests/http/hosting-providers.test.ts`
   - Tests various hosting provider integrations
   - Priority: MEDIUM
9. ⏳ `__tests__/http/test-submodules.js` → `tests/http/submodules.test.ts`
   - Tests submodule operations
   - Priority: LOW
10. ⏳ `__tests__/http/test-clone-checkout-huge-repo.js` → `tests/http/clone-huge-repo.test.ts`
    - Tests cloning large repositories
    - Priority: MEDIUM
11. ⏳ `__tests__/http/test-checkout.js` → `tests/http/checkout.test.ts`
    - Tests checkout operations (verify if different from commands)
    - Priority: MEDIUM

**Priority 3: Wire Protocol Tests (Medium Priority)**
12. ⏳ `__tests__/test-packObjects.js` → `tests/objects/packObjects.test.ts`
    - Tests pack object operations (24.67% coverage)
    - Priority: MEDIUM
13. ⏳ `__tests__/test-uploadPack.js` → `tests/wire/uploadPack.test.ts`
    - Tests upload pack protocol (11.86% coverage)
    - Priority: MEDIUM
14. ⏳ `__tests__/test-wire.js` → `tests/wire/wire.test.ts`
    - Tests wire protocol (verify what this tests)
    - Priority: MEDIUM

**Priority 4: Internal API Tests (Lower Priority)**
15. ⏳ `__tests__/snapshot/test-exports.js` → `tests/api/exports.test.ts`
    - Tests API surface validation (ensures correct exports)
    - Priority: MEDIUM
16. ⏳ `__tests__/snapshot/test-GitError.js` → `tests/errors/GitError.test.ts`
    - Tests error class instantiation and properties
    - Priority: LOW
17. ⏳ `__tests__/snapshot/test-flatFileListToDirectoryStructure.js` → `tests/utils/flatFileListToDirectoryStructure.test.ts`
    - Tests internal utility function
    - Priority: LOW
18. ⏳ `__tests__/snapshot/test-GitIndex.js` → `tests/managers/GitIndex.test.ts`
    - Tests internal GitIndex manager
    - Priority: LOW (internal API)
19. ⏳ `__tests__/snapshot/test-GitRefManager.js` → `tests/managers/GitRefManager.test.ts`
    - Tests internal GitRefManager
    - Priority: LOW (internal API)
20. ⏳ `__tests__/snapshot/test-GitPackIndex.js` → `tests/models/GitPackIndex.test.ts`
    - Tests internal GitPackIndex model
    - Priority: LOW (internal API)

### Migration Process

For each legacy test file:

1. **Read Legacy Test**
   - Understand what it tests
   - Identify test cases
   - Note fixture dependencies

2. **Check Existing Migration**
   - Check if test already exists in `tests/`
   - Compare test cases
   - Identify missing tests

3. **Create/Update Test File**
   - Create new file in `tests/` with `.test.ts` extension
   - Use correct directory structure:
     - Commands → `tests/commands/`
     - HTTP → `tests/http/`
     - Utils → `tests/utils/`
     - Models → `tests/models/`
     - Errors → `tests/errors/`
     - Managers → `tests/managers/`
     - Objects → `tests/objects/`
     - Wire → `tests/wire/`
     - API → `tests/api/`

4. **Convert Syntax**
   - Replace `describe()` → `test()` or keep `describe()` (Node.js supports both)
   - Replace `it()` → `t.test()` or keep `it()` (Node.js supports both)
   - Replace `expect()` → `assert`
   - Replace `toMatchInlineSnapshot()` → explicit assertions
   - Replace `toBe()`, `toEqual()` → `assert.strictEqual()`, `assert.deepStrictEqual()`
   - Replace `toBeNull()`, `toBeDefined()` → `assert.strictEqual()`, `assert.notStrictEqual()`

5. **Update Imports**
   - Replace `import { makeFixture } from '../__helpers__/FixtureFS.js'`
   - With `import { makeFixture } from '../helpers/fixture.ts'`
   - Update API imports if needed
   - Update relative paths

6. **Update Fixture Paths**
   - Fixture names should remain the same (e.g., `'test-readCommit'`)
   - `makeFixture()` helper handles path resolution

7. **Run Tests**
   - Run: `node --experimental-strip-types --test tests/path/to/test.test.ts`
   - Fix any failures
   - Ensure all test cases pass

8. **Verify Coverage**
   - Run coverage: `npm run coverage` or `c8 npm test`
   - Verify test is included in coverage report
   - Check that tested code shows up in coverage

9. **Mark as Complete**
   - Update this plan with ✅
   - Delete legacy test file from `__tests__/`
   - Commit changes

### Notes

- **Fixtures**: Can stay in `__tests__/__fixtures__/` or move to `tests/fixtures/`. Recommend keeping them where they are during migration to avoid breaking tests.
- **Helpers**: `tests/helpers/fixture.ts` already exists and works. Legacy `FixtureFS.js` can be removed after migration.
- **Priority**: Focus on high-value tests first (commands, HTTP) before internal utilities.
- **Testing**: Run tests frequently during migration to catch issues early.
- **Coverage**: Verify coverage after each phase to ensure it's working correctly.

---

## Implementation Strategy

### Step 1: Quick Wins (Week 1)
1. ⏳ Add tests for zero-coverage utility functions
2. ✅ **COMPLETED** - Enhanced tests for `getConfig.ts` and `getConfigAll.ts` in `tests/config/config.test.ts` (9 new test cases)
3. ⏳ Add basic tests for error classes
4. ✅ **COMPLETED** - Enhanced tests for `expandOid.ts` in `tests/refs/expandOid.test.ts` (5 new test cases)
5. ✅ **COMPLETED** - Enhanced tests for `hashBlob.ts` in `tests/utils/hashBlob.test.ts` (8 new test cases)

### Step 2: Critical Paths (Week 2-3)
1. Add comprehensive tests for `push.ts`
2. Add tests for `pull.ts` edge cases
3. Add tests for `MergeManager.ts`

### Step 3: Network & Protocol (Week 4)
1. ✅ **COMPLETED** - Added tests for wire protocol parsers/writers
   - ✅ Created `tests/wire/parseUploadPackResponse.test.ts` with 14 test cases
   - ✅ Created `tests/wire/writeReceivePackRequest.test.ts` with 8 test cases
   - ✅ Created `tests/wire/writeUploadPackRequest.test.ts` with 15 test cases
2. ⏳ Add tests for upload pack operations (uploadPack.ts)
3. ⏳ Add browser HTTP tests
4. ⏳ **LEGACY MIGRATION**: Migrate HTTP tests from `__tests__/http/` (test-fetch, test-pull, test-push, etc.)

### Step 4: Edge Cases & Branches (Week 5-6)
1. Improve branch coverage for merge operations
2. Add tests for error handling paths
3. Add tests for filesystem edge cases

### Step 5: Legacy Test Migration (Ongoing)
1. ⏳ Migrate remaining command tests (test-listObjects.js)
2. ⏳ Migrate HTTP/network tests (10 files from `__tests__/http/`)
3. ⏳ Migrate wire protocol tests (test-packObjects.js, test-uploadPack.js, test-wire.js)
4. ⏳ Migrate internal API tests (test-exports.js, test-GitError.js, etc.)
5. ⏳ Remove `__tests__/` directory after all migrations complete

### Step 6: Maintenance (Ongoing)
1. Set up coverage thresholds in CI
2. Require coverage checks in PRs
3. Regular coverage reviews

---

## Testing Best Practices

1. **Unit Tests**: Test individual functions in isolation
2. **Integration Tests**: Test component interactions
3. **Edge Cases**: Test boundary conditions, error paths
4. **Error Scenarios**: Test all error conditions
5. **Mock External Dependencies**: Use fixtures for file system operations

---

## Coverage Thresholds

Add to `.c8rc.json`:
```json
{
  "check-coverage": true,
  "lines": 80,
  "functions": 75,
  "branches": 80,
  "statements": 80
}
```

---

## Metrics Tracking

Track progress using:
- `npm run test:coverage` - Generate coverage report
- Review `coverage/index.html` for detailed breakdown
- Focus on files with < 70% coverage first
- Prioritize user-facing APIs over internal utilities

---

## Notes

- Some files are deprecated (see CLEANUP_PLAN.md) - don't invest in testing deprecated code
- Focus on `src/git/` structure over `src/storage/` and `src/core-utils/odb/`
- Browser-specific code (`src/http/web/`) may need separate test environment
- Network protocol tests may require mock servers
- **Test Infrastructure**: All new tests must use Node.js native test runner format in `tests/` directory
- **Legacy Tests**: Tests in `__tests__/` directory are legacy and need to be migrated to `tests/` with proper format (see Phase 7 for migration plan)

## Recent Progress

**Completed (2024):**
- ✅ Enhanced `tests/config/config.test.ts` - Added 9 test cases for getConfig/getConfigAll
- ✅ Enhanced `tests/refs/expandOid.test.ts` - Added 5 test cases for expandOid
- ✅ Enhanced `tests/utils/hashBlob.test.ts` - Added 8 test cases for hashBlob
- ✅ Created `tests/commands/isDescendent.test.ts` - Added 22 test cases for isDescendent covering relationships, depth limits, error handling, and edge cases
- ✅ Created `tests/core-utils/algorithms/MergeManager.test.ts` - Added 15 test cases for mergeBlobs covering clean merges, conflicts, markers, edge cases
- ✅ Created `tests/wire/parseReceivePackResponse.test.ts` - Added 12 test cases for parseReceivePackResponse covering success/failure scenarios, ref rejections, error handling
- ✅ Created `tests/wire/parseRefsAdResponse.test.ts` - Added 15 test cases for parseRefsAdResponse covering protocol v1 and v2, refs, capabilities, symrefs, error handling
- ✅ Created `tests/wire/parseUploadPackResponse.test.ts` - Added 14 test cases for parseUploadPackResponse covering ACK, NAK, shallow/unshallow, error handling
- ✅ Created `tests/wire/writeReceivePackRequest.test.ts` - Added 8 test cases for writeReceivePackRequest covering triplets, capabilities, edge cases
- ✅ Created `tests/wire/writeUploadPackRequest.test.ts` - Added 15 test cases for writeUploadPackRequest covering wants, haves, shallows, depth, since, exclude, capabilities
- ✅ Created `tests/core-utils/algorithms/SequencerManager.test.ts` - Added 18 test cases for SequencerManager covering rebase operations, todo list management, head/onto reading
- ✅ Created `tests/commands/listCommitsAndTags.test.ts` - Added 8 test cases for listCommitsAndTags covering start/finish refs, annotated tags, shallow commits, edge cases
- ✅ Created `tests/utils/DeepMap.test.ts` - Added 13 test cases for DeepMap covering nested maps, set/get/has operations, edge cases
- ✅ Created `tests/utils/compareAge.test.ts` - Added 4 test cases for compareAge covering age comparison, committer timestamp
- ✅ Created `tests/utils/compareRefNames.test.ts` - Added 10 test cases for compareRefNames covering ref comparison, ^{} suffix handling
- ✅ Created `tests/utils/fromEntries.test.ts` - Added 6 test cases for fromEntries covering map to object conversion
- ✅ Created `tests/utils/compare.test.ts` - Added 18 test cases for unified comparison utilities (compareStrings, comparePath, compareTreeEntryPath, compareRefNames, compareAge)
- ✅ Created `tests/utils/errorFactory.test.ts` - Added 9 test cases for error factory functions (createErrorClass, createTypedErrorClass)
- ✅ Created `tests/utils/fromStream.test.ts` - Added 6 test cases for ReadableStream to async iterator conversion
- ✅ Created `tests/utils/normalizeIdentity.test.ts` - Added 8 test cases for identity normalization (author/committer, priority chains)
- ✅ Created `tests/utils/resolveFileIdInTree.test.ts` - Added 11 test cases for resolving file IDs in trees (root files, nested directories, multiple matches, edge cases)
- ✅ Created `tests/models/RunningMinimum.test.ts` - Added 12 test cases for RunningMinimum covering consider operations, reset, null/undefined handling, and different value types
- ✅ Created `tests/core-utils/filesystem/LineEndingFilter.test.ts` - Added 22 test cases for line ending conversion (lf, crlf, auto, binary, unicode, etc.)
- ✅ Created `tests/core-utils/filesystem/GitAttributesParser.test.ts` - Added 18 test cases for gitattributes parsing and loading, and fixed pattern matching bug
- ✅ Created `tests/errors/BaseError.test.ts` - Added 14 test cases for BaseError class (constructor, serialization, error chaining)
- ✅ Fixed circular import in `src/commands/pull.ts` and implemented `_pull` function
- ✅ Fixed `SubmoduleManager` import in `src/commands/submodule.ts`
- ✅ Fixed pattern matching bug in `src/core-utils/filesystem/GitAttributesParser.ts` (removed incorrect negation)
- ✅ Removed incorrectly created legacy test files from `__tests__/snapshot/`
- ✅ **LEGACY TEST CLEANUP**: Removed 15 already-migrated test files from `__tests__/snapshot/` (test-readCommit, test-readBlob, test-updateIndex, test-resetIndex, test-remove, test-readTag, test-readTree, test-readObject, test-add, test-log, test-log-file, test-listBranches, test-listTags, test-listRefs, test-listFiles)
- ✅ **CONSOLIDATION**: Merged LEGACY_TEST_MIGRATION_PLAN.md into TEST_COVERAGE_IMPROVEMENT_PLAN.md (Phase 7)
- **Total**: 288 new test cases added to improve coverage
- **Remaining**: 20 legacy tests still need migration (see Phase 7)

---

## Success Criteria

- [ ] Overall coverage > 80% for statements
- [ ] Overall coverage > 80% for branches
- [ ] All user-facing APIs (`src/api/`) > 75% coverage
- [ ] Critical paths (`merge`, `push`, `pull`) > 85% coverage
- [ ] Zero coverage files either tested or marked as deprecated
- [ ] Coverage thresholds enforced in CI

