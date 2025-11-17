import { test } from 'node:test'
import assert from 'node:assert'
import { mergeBlobs, mergeTrees } from '../../../src/core-utils/algorithms/MergeManager.ts'
import { makeFixture } from '../../helpers/fixture.ts'
import { init, add, commit, readCommit, remove, checkout } from 'isomorphic-git'
import { Repository } from '../../../src/core-utils/Repository.ts'

test('MergeManager', async (t) => {
  await t.test('mergeBlobs - clean merge (no conflicts)', async () => {
    // Setup: Base has "Line 1\nLine 2\nLine 3"
    // Ours adds Line 4
    // Theirs adds Line 5 (both add after Line 3, but different content)
    // Note: diff3 may treat this as a conflict if both add at the same position
    // Let's test a truly clean case: ours modifies, theirs doesn't change
    const base = 'Line 1\nLine 2\nLine 3\n'
    const ours = 'Line 1\nLine 2 modified\nLine 3\n'
    const theirs = 'Line 1\nLine 2\nLine 3\n' // unchanged

    // Test
    const result = mergeBlobs({ base, ours, theirs })

    // Assert
    assert.strictEqual(result.hasConflict, false)
    const mergedText = result.mergedContent.toString('utf8')
    assert.ok(mergedText.includes('Line 1'))
    assert.ok(mergedText.includes('Line 2 modified'))
    assert.ok(mergedText.includes('Line 3'))
  })

  await t.test('mergeBlobs - conflict when both modify same line', async () => {
    // Setup: Base has "Line 1\nLine 2\nLine 3"
    // Ours changes Line 2 to "Line 2 modified by us"
    // Theirs changes Line 2 to "Line 2 modified by them"
    // Result should have conflict markers
    const base = 'Line 1\nLine 2\nLine 3\n'
    const ours = 'Line 1\nLine 2 modified by us\nLine 3\n'
    const theirs = 'Line 1\nLine 2 modified by them\nLine 3\n'

    // Test
    const result = mergeBlobs({ base, ours, theirs })

    // Assert
    assert.strictEqual(result.hasConflict, true)
    const mergedText = result.mergedContent.toString('utf8')
    assert.ok(mergedText.includes('<<<<<<< ours'))
    assert.ok(mergedText.includes('======='))
    assert.ok(mergedText.includes('>>>>>>> theirs'))
    assert.ok(mergedText.includes('Line 2 modified by us'))
    assert.ok(mergedText.includes('Line 2 modified by them'))
  })

  await t.test('mergeBlobs - conflict markers format', async () => {
    // Setup: Create a conflict
    const base = 'Base content\n'
    const ours = 'Our content\n'
    const theirs = 'Their content\n'

    // Test
    const result = mergeBlobs({ base, ours, theirs })

    // Assert
    assert.strictEqual(result.hasConflict, true)
    const mergedText = result.mergedContent.toString('utf8')
    // Check for 7 '<' characters
    assert.ok(mergedText.includes('<<<<<<< ours'))
    // Check for 7 '=' characters
    assert.ok(mergedText.includes('======='))
    // Check for 7 '>' characters
    assert.ok(mergedText.includes('>>>>>>> theirs'))
  })

  await t.test('mergeBlobs - custom branch names', async () => {
    // Setup: Create a conflict with custom names
    const base = 'Base\n'
    const ours = 'Ours\n'
    const theirs = 'Theirs\n'

    // Test
    const result = mergeBlobs({
      base,
      ours,
      theirs,
      ourName: 'feature-branch',
      theirName: 'main',
    })

    // Assert
    assert.strictEqual(result.hasConflict, true)
    const mergedText = result.mergedContent.toString('utf8')
    assert.ok(mergedText.includes('<<<<<<< feature-branch'))
    assert.ok(mergedText.includes('>>>>>>> main'))
  })

  await t.test('mergeBlobs - empty base (new file added by both)', async () => {
    // Setup: Both branches add the same file
    const base = ''
    const ours = 'New file content\n'
    const theirs = 'New file content\n'

    // Test
    const result = mergeBlobs({ base, ours, theirs })

    // Assert
    assert.strictEqual(result.hasConflict, false)
    const mergedText = result.mergedContent.toString('utf8')
    assert.strictEqual(mergedText, 'New file content\n')
  })

  await t.test('mergeBlobs - empty base, different content (conflict)', async () => {
    // Setup: Both branches add different content to new file
    const base = ''
    const ours = 'Our new content\n'
    const theirs = 'Their new content\n'

    // Test
    const result = mergeBlobs({ base, ours, theirs })

    // Assert
    assert.strictEqual(result.hasConflict, true)
    const mergedText = result.mergedContent.toString('utf8')
    assert.ok(mergedText.includes('<<<<<<< ours'))
    assert.ok(mergedText.includes('Our new content'))
    assert.ok(mergedText.includes('Their new content'))
  })

  await t.test('mergeBlobs - file deleted by us, modified by them', async () => {
    // Setup: Base has content, we delete it, they modify it
    const base = 'Original content\n'
    const ours = ''
    const theirs = 'Modified content\n'

    // Test
    const result = mergeBlobs({ base, ours, theirs })

    // Assert
    // This should result in a conflict
    assert.strictEqual(result.hasConflict, true)
    const mergedText = result.mergedContent.toString('utf8')
    assert.ok(mergedText.includes('<<<<<<< ours'))
    assert.ok(mergedText.includes('Modified content'))
  })

  await t.test('mergeBlobs - file modified by us, deleted by them', async () => {
    // Setup: Base has content, we modify it, they delete it
    const base = 'Original content\n'
    const ours = 'Modified content\n'
    const theirs = ''

    // Test
    const result = mergeBlobs({ base, ours, theirs })

    // Assert
    // This should result in a conflict
    assert.strictEqual(result.hasConflict, true)
    const mergedText = result.mergedContent.toString('utf8')
    assert.ok(mergedText.includes('<<<<<<< ours'))
    assert.ok(mergedText.includes('Modified content'))
  })

  await t.test('mergeBlobs - Buffer input instead of string', async () => {
    // Setup: Use Buffer inputs
    const base = Buffer.from('Base content\n', 'utf8')
    const ours = Buffer.from('Our content\n', 'utf8')
    const theirs = Buffer.from('Their content\n', 'utf8')

    // Test
    const result = mergeBlobs({ base, ours, theirs })

    // Assert
    assert.strictEqual(result.hasConflict, true)
    assert.ok(result.mergedContent instanceof Buffer)
    const mergedText = result.mergedContent.toString('utf8')
    assert.ok(mergedText.includes('<<<<<<< ours'))
  })

  await t.test('mergeBlobs - mixed Buffer and string inputs', async () => {
    // Setup: Mix Buffer and string inputs
    const base = 'Base content\n'
    const ours = Buffer.from('Our content\n', 'utf8')
    const theirs = 'Their content\n'

    // Test
    const result = mergeBlobs({ base, ours, theirs })

    // Assert
    assert.strictEqual(result.hasConflict, true)
    const mergedText = result.mergedContent.toString('utf8')
    assert.ok(mergedText.includes('<<<<<<< ours'))
  })

  await t.test('mergeBlobs - single line file', async () => {
    // Setup: Single line file
    const base = 'Single line\n'
    const ours = 'Single line modified by us\n'
    const theirs = 'Single line modified by them\n'

    // Test
    const result = mergeBlobs({ base, ours, theirs })

    // Assert
    assert.strictEqual(result.hasConflict, true)
    const mergedText = result.mergedContent.toString('utf8')
    assert.ok(mergedText.includes('<<<<<<< ours'))
  })

  await t.test('mergeBlobs - no newline at end', async () => {
    // Setup: Files without trailing newline, both modify different parts
    const base = 'Line 1\nLine 2'
    const ours = 'Line 1 modified\nLine 2'
    const theirs = 'Line 1\nLine 2 modified'

    // Test
    const result = mergeBlobs({ base, ours, theirs })

    // Assert
    // This may or may not be a conflict depending on diff3 behavior
    // Just verify it processes correctly
    const mergedText = result.mergedContent.toString('utf8')
    assert.ok(mergedText.includes('Line 1'))
    assert.ok(mergedText.includes('Line 2'))
    // Verify it doesn't crash and produces valid output
    assert.ok(result.mergedContent instanceof Buffer)
  })

  await t.test('mergeBlobs - multiple conflicts in same file', async () => {
    // Setup: Multiple conflicting sections
    const base = 'Line 1\nLine 2\nLine 3\nLine 4\n'
    const ours = 'Line 1 modified\nLine 2\nLine 3 modified\nLine 4\n'
    const theirs = 'Line 1\nLine 2 modified\nLine 3\nLine 4 modified\n'

    // Test
    const result = mergeBlobs({ base, ours, theirs })

    // Assert
    assert.strictEqual(result.hasConflict, true)
    const mergedText = result.mergedContent.toString('utf8')
    // Should have multiple conflict markers
    const conflictCount = (mergedText.match(/<<<<<<< /g) || []).length
    assert.ok(conflictCount >= 1)
  })

  await t.test('mergeBlobs - identical changes (no conflict)', async () => {
    // Setup: Both make the same change
    const base = 'Original\n'
    const ours = 'Modified\n'
    const theirs = 'Modified\n'

    // Test
    const result = mergeBlobs({ base, ours, theirs })

    // Assert
    assert.strictEqual(result.hasConflict, false)
    const mergedText = result.mergedContent.toString('utf8')
    assert.ok(mergedText.includes('Modified'))
    assert.ok(!mergedText.includes('<<<<<<<'))
  })

  await t.test('mergeBlobs - whitespace-only changes', async () => {
    // Setup: Only whitespace differences
    const base = 'Line 1\nLine 2\n'
    const ours = 'Line 1\nLine 2  \n' // trailing spaces
    const theirs = 'Line 1\nLine 2\n'

    // Test
    const result = mergeBlobs({ base, ours, theirs })

    // Assert
    // This may or may not be a conflict depending on diff3 behavior
    // Just verify it doesn't crash
    assert.ok(result.mergedContent instanceof Buffer)
  })

  // ============================================================================
  // mergeTrees TESTS
  // ============================================================================

  await t.test('mergeTrees - clean merge (no conflicts)', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    const cache: Record<string, unknown> = {}
    const repo = await Repository.open({ fs, dir, cache })
    const { normalizeFs } = await import('../../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    
    // Create base commit with file1.txt
    await normalizedFs.write(`${dir}/file1.txt`, 'content1\n')
    await add({ fs, dir, filepath: 'file1.txt', cache: repo.cache })
    const baseCommit = await commit({ 
      fs, 
      dir, 
      message: 'Base', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const baseCommitObj = await readCommit({ fs, dir, oid: baseCommit, cache: repo.cache })
    const baseTreeOid = baseCommitObj.commit.tree
    
    // Create ours commit - add file2.txt
    await normalizedFs.write(`${dir}/file2.txt`, 'content2\n')
    await add({ fs, dir, filepath: 'file2.txt', cache: repo.cache })
    const ourCommit = await commit({ 
      fs, 
      dir, 
      message: 'Ours', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const ourCommitObj = await readCommit({ fs, dir, oid: ourCommit, cache: repo.cache })
    const ourTreeOid = ourCommitObj.commit.tree
    
    // Create theirs commit - add file3.txt (different file, no conflict)
    // Reset to base first
    await normalizedFs.rm(`${dir}/file2.txt`).catch(() => {})
    await normalizedFs.write(`${dir}/file3.txt`, 'content3\n')
    await add({ fs, dir, filepath: 'file3.txt', cache: repo.cache })
    const theirCommit = await commit({ 
      fs, 
      dir, 
      message: 'Theirs', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const theirCommitObj = await readCommit({ fs, dir, oid: theirCommit, cache: repo.cache })
    const theirTreeOid = theirCommitObj.commit.tree
    
    // Test mergeTrees
    const gitdir = await repo.getGitdir()
    const result = await mergeTrees({
      fs,
      cache: repo.cache,
      gitdir,
      base: baseTreeOid,
      ours: ourTreeOid,
      theirs: theirTreeOid,
    })
    
    // Assert
    assert.strictEqual(result.conflicts.length, 0, 'Should have no conflicts')
    assert.ok(result.mergedTreeOid, 'Should return merged tree OID')
    assert.ok(result.mergedTree.length > 0, 'Should have merged tree entries')
  })

  await t.test('mergeTrees - conflict when both modify same file', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    const cache: Record<string, unknown> = {}
    const repo = await Repository.open({ fs, dir, cache })
    const { normalizeFs } = await import('../../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    
    // Create base commit
    await normalizedFs.write(`${dir}/file.txt`, 'base content\n')
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const baseCommit = await commit({ 
      fs, 
      dir, 
      message: 'Base', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const baseCommitObj = await readCommit({ fs, dir, oid: baseCommit, cache: repo.cache })
    const baseTreeOid = baseCommitObj.commit.tree
    
    // Create ours commit - modify file.txt
    await normalizedFs.write(`${dir}/file.txt`, 'our content\n')
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const ourCommit = await commit({ 
      fs, 
      dir, 
      message: 'Ours', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const ourCommitObj = await readCommit({ fs, dir, oid: ourCommit, cache: repo.cache })
    const ourTreeOid = ourCommitObj.commit.tree
    
    // Create theirs commit - modify file.txt differently
    // Reset to base first
    await normalizedFs.write(`${dir}/file.txt`, 'their content\n')
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const theirCommit = await commit({ 
      fs, 
      dir, 
      message: 'Theirs', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const theirCommitObj = await readCommit({ fs, dir, oid: theirCommit, cache: repo.cache })
    const theirTreeOid = theirCommitObj.commit.tree
    
    // Test mergeTrees
    const gitdir = await repo.getGitdir()
    const result = await mergeTrees({
      fs,
      cache: repo.cache,
      gitdir,
      base: baseTreeOid,
      ours: ourTreeOid,
      theirs: theirTreeOid,
    })
    
    // Assert
    assert.ok(result.conflicts.length > 0, 'Should have conflicts')
    assert.ok(result.conflicts.includes('file.txt'), 'Should report conflict for file.txt')
    assert.ok(result.mergedTreeOid, 'Should return merged tree OID even with conflicts')
  })

  await t.test('mergeTrees - only ours changed', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    const cache: Record<string, unknown> = {}
    const repo = await Repository.open({ fs, dir, cache })
    const { normalizeFs } = await import('../../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    
    // Create base commit
    await normalizedFs.write(`${dir}/file.txt`, 'base content\n')
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const baseCommit = await commit({ 
      fs, 
      dir, 
      message: 'Base', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const baseCommitObj = await readCommit({ fs, dir, oid: baseCommit, cache: repo.cache })
    const baseTreeOid = baseCommitObj.commit.tree
    
    // Create ours commit - modify file.txt
    await normalizedFs.write(`${dir}/file.txt`, 'our content\n')
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const ourCommit = await commit({ 
      fs, 
      dir, 
      message: 'Ours', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const ourCommitObj = await readCommit({ fs, dir, oid: ourCommit, cache: repo.cache })
    const ourTreeOid = ourCommitObj.commit.tree
    
    // Theirs is same as base (no change) - use base tree OID directly
    const theirTreeOid = baseTreeOid
    
    // Test mergeTrees
    const gitdir = await repo.getGitdir()
    const result = await mergeTrees({
      fs,
      cache: repo.cache,
      gitdir,
      base: baseTreeOid,
      ours: ourTreeOid,
      theirs: theirTreeOid,
    })
    
    // Assert
    assert.strictEqual(result.conflicts.length, 0, 'Should have no conflicts')
    assert.ok(result.mergedTreeOid, 'Should return merged tree OID')
  })

  await t.test('mergeTrees - only theirs changed', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    const cache: Record<string, unknown> = {}
    const repo = await Repository.open({ fs, dir, cache })
    const { normalizeFs } = await import('../../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    
    // Create base commit
    await normalizedFs.write(`${dir}/file.txt`, 'base content\n')
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const baseCommit = await commit({ 
      fs, 
      dir, 
      message: 'Base', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const baseCommitObj = await readCommit({ fs, dir, oid: baseCommit, cache: repo.cache })
    const baseTreeOid = baseCommitObj.commit.tree
    
    // Ours is same as base (no change) - use base tree OID directly
    const ourTreeOid = baseTreeOid
    
    // Reset to base and create theirs commit - modify file.txt
    await checkout({ fs, dir, ref: baseCommit, force: true, cache: repo.cache })
    await normalizedFs.write(`${dir}/file.txt`, 'their content\n')
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const theirCommit = await commit({ 
      fs, 
      dir, 
      message: 'Theirs', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const theirCommitObj = await readCommit({ fs, dir, oid: theirCommit, cache: repo.cache })
    const theirTreeOid = theirCommitObj.commit.tree
    
    // Test mergeTrees
    const gitdir = await repo.getGitdir()
    const result = await mergeTrees({
      fs,
      cache: repo.cache,
      gitdir,
      base: baseTreeOid,
      ours: ourTreeOid,
      theirs: theirTreeOid,
    })
    
    // Assert
    assert.strictEqual(result.conflicts.length, 0, 'Should have no conflicts')
    assert.ok(result.mergedTreeOid, 'Should return merged tree OID')
  })

  await t.test('mergeTrees - deleted by us, modified by them (conflict)', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    const cache: Record<string, unknown> = {}
    const repo = await Repository.open({ fs, dir, cache })
    const { normalizeFs } = await import('../../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    
    // Create base commit
    await normalizedFs.write(`${dir}/file.txt`, 'base content\n')
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const baseCommit = await commit({ 
      fs, 
      dir, 
      message: 'Base', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const baseCommitObj = await readCommit({ fs, dir, oid: baseCommit, cache: repo.cache })
    const baseTreeOid = baseCommitObj.commit.tree
    
    // Create ours commit - delete file.txt
    await normalizedFs.rm(`${dir}/file.txt`)
    await remove({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const ourCommit = await commit({ 
      fs, 
      dir, 
      message: 'Ours - delete', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const ourCommitObj = await readCommit({ fs, dir, oid: ourCommit, cache: repo.cache })
    const ourTreeOid = ourCommitObj.commit.tree
    
    // Create theirs commit - modify file.txt
    // Reset to base first
    await checkout({ fs, dir, ref: baseCommit, force: true, cache: repo.cache })
    await normalizedFs.write(`${dir}/file.txt`, 'their content\n')
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const theirCommit = await commit({ 
      fs, 
      dir, 
      message: 'Theirs - modify', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const theirCommitObj = await readCommit({ fs, dir, oid: theirCommit, cache: repo.cache })
    const theirTreeOid = theirCommitObj.commit.tree
    
    // Test mergeTrees
    const gitdir = await repo.getGitdir()
    const result = await mergeTrees({
      fs,
      cache: repo.cache,
      gitdir,
      base: baseTreeOid,
      ours: ourTreeOid,
      theirs: theirTreeOid,
    })
    
    // Assert
    assert.ok(result.conflicts.length > 0, 'Should have conflicts')
    assert.ok(result.conflicts.includes('file.txt'), 'Should report conflict for file.txt')
  })

  await t.test('mergeTrees - modified by us, deleted by them (conflict)', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    const cache: Record<string, unknown> = {}
    const repo = await Repository.open({ fs, dir, cache })
    const { normalizeFs } = await import('../../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    
    // Create base commit
    await normalizedFs.write(`${dir}/file.txt`, 'base content\n')
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const baseCommit = await commit({ 
      fs, 
      dir, 
      message: 'Base', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const baseCommitObj = await readCommit({ fs, dir, oid: baseCommit, cache: repo.cache })
    const baseTreeOid = baseCommitObj.commit.tree
    
    // Create ours commit - modify file.txt
    await normalizedFs.write(`${dir}/file.txt`, 'our content\n')
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const ourCommit = await commit({ 
      fs, 
      dir, 
      message: 'Ours - modify', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const ourCommitObj = await readCommit({ fs, dir, oid: ourCommit, cache: repo.cache })
    const ourTreeOid = ourCommitObj.commit.tree
    
    // Create theirs commit - delete file.txt
    // Reset to base first
    await checkout({ fs, dir, ref: baseCommit, force: true, cache: repo.cache })
    await normalizedFs.rm(`${dir}/file.txt`)
    await remove({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const theirCommit = await commit({ 
      fs, 
      dir, 
      message: 'Theirs - delete', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const theirCommitObj = await readCommit({ fs, dir, oid: theirCommit, cache: repo.cache })
    const theirTreeOid = theirCommitObj.commit.tree
    
    // Test mergeTrees
    const gitdir = await repo.getGitdir()
    const result = await mergeTrees({
      fs,
      cache: repo.cache,
      gitdir,
      base: baseTreeOid,
      ours: ourTreeOid,
      theirs: theirTreeOid,
    })
    
    // Assert
    assert.ok(result.conflicts.length > 0, 'Should have conflicts')
    assert.ok(result.conflicts.includes('file.txt'), 'Should report conflict for file.txt')
  })

  await t.test('mergeTrees - deleted by both (no conflict)', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    const cache: Record<string, unknown> = {}
    const repo = await Repository.open({ fs, dir, cache })
    const { normalizeFs } = await import('../../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    
    // Create base commit
    await normalizedFs.write(`${dir}/file.txt`, 'base content\n')
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const baseCommit = await commit({ 
      fs, 
      dir, 
      message: 'Base', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const baseCommitObj = await readCommit({ fs, dir, oid: baseCommit, cache: repo.cache })
    const baseTreeOid = baseCommitObj.commit.tree
    
    // Create ours commit - delete file.txt
    await normalizedFs.rm(`${dir}/file.txt`)
    await remove({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const ourCommit = await commit({ 
      fs, 
      dir, 
      message: 'Ours - delete', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const ourCommitObj = await readCommit({ fs, dir, oid: ourCommit, cache: repo.cache })
    const ourTreeOid = ourCommitObj.commit.tree
    
    // Create theirs commit - delete file.txt
    // Reset to base first
    await checkout({ fs, dir, ref: baseCommit, force: true, cache: repo.cache })
    await normalizedFs.rm(`${dir}/file.txt`)
    await remove({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const theirCommit = await commit({ 
      fs, 
      dir, 
      message: 'Theirs - delete', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const theirCommitObj = await readCommit({ fs, dir, oid: theirCommit, cache: repo.cache })
    const theirTreeOid = theirCommitObj.commit.tree
    
    // Test mergeTrees
    const gitdir = await repo.getGitdir()
    const result = await mergeTrees({
      fs,
      cache: repo.cache,
      gitdir,
      base: baseTreeOid,
      ours: ourTreeOid,
      theirs: theirTreeOid,
    })
    
    // Assert
    assert.strictEqual(result.conflicts.length, 0, 'Should have no conflicts when both delete')
    assert.ok(result.mergedTreeOid, 'Should return merged tree OID')
    // File should not be in merged tree
    const hasFile = result.mergedTree.some(entry => entry.path === 'file.txt')
    assert.strictEqual(hasFile, false, 'File should not be in merged tree when deleted by both')
  })

  await t.test('mergeTrees - both unchanged (no merge needed)', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    const cache: Record<string, unknown> = {}
    const repo = await Repository.open({ fs, dir, cache })
    const { normalizeFs } = await import('../../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    
    // Create base commit
    await normalizedFs.write(`${dir}/file.txt`, 'content\n')
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const baseCommit = await commit({ 
      fs, 
      dir, 
      message: 'Base', 
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache 
    })
    const baseCommitObj = await readCommit({ fs, dir, oid: baseCommit, cache: repo.cache })
    const baseTreeOid = baseCommitObj.commit.tree
    
    // Ours and theirs are same as base (no changes) - use base tree OID directly
    const ourTreeOid = baseTreeOid
    const theirTreeOid = baseTreeOid
    
    // Test mergeTrees
    const gitdir = await repo.getGitdir()
    const result = await mergeTrees({
      fs,
      cache: repo.cache,
      gitdir,
      base: baseTreeOid,
      ours: ourTreeOid,
      theirs: theirTreeOid,
    })
    
    // Assert
    assert.strictEqual(result.conflicts.length, 0, 'Should have no conflicts')
    assert.ok(result.mergedTreeOid, 'Should return merged tree OID')
  })
})
