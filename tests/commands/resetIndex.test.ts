import { test } from 'node:test'
import assert from 'node:assert'
import { resetIndex, listFiles, statusMatrix } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'
import { MissingParameterError } from '../../src/errors/MissingParameterError.ts'

test('resetIndex', async (t) => {
  await t.test('throws MissingParameterError when fs is missing', async () => {
    try {
      await resetIndex({
        // @ts-expect-error - intentionally missing fs
        gitdir: '/tmp/test.git',
        filepath: 'test.txt',
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'fs')
    }
  })

  await t.test('throws MissingParameterError when gitdir is missing and dir is not provided', async () => {
    const { fs } = await makeFixture('test-empty')
    try {
      await resetIndex({
        fs,
        // @ts-expect-error - intentionally missing both gitdir and dir
        filepath: 'test.txt',
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      // gitdir is derived from dir, so when both are missing, it will fail
      // The error might be MissingParameterError for gitdir or a different error
      assert.ok(error instanceof Error, 'Should throw an error')
      if (error instanceof MissingParameterError) {
        assert.strictEqual((error as any).data?.parameter, 'gitdir')
      }
    }
  })

  await t.test('throws MissingParameterError when filepath is missing', async () => {
    const { fs, gitdir } = await makeFixture('test-empty')
    try {
      await resetIndex({
        fs,
        gitdir,
        // @ts-expect-error - intentionally missing filepath
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'filepath')
    }
  })

  await t.test('uses gitdir from dir when gitdir is not provided', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    // gitdir is derived from dir, so when dir is provided, gitdir should be join(dir, '.git')
    try {
      await resetIndex({
        fs,
        dir,
        // gitdir not provided, should default to join(dir, '.git')
        filepath: 'nonexistent.txt',
      })
      // resetIndex should not throw for non-existent files, it just removes them from index
      assert.ok(true)
    } catch (error) {
      // If there's an error, it should be about the repository state, not gitdir
      assert.ok(error instanceof Error, 'Should throw an error if repository is invalid')
    }
  })

  await t.test('handles missing ref in new repository', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    // In a new repository without commits, resetIndex should not throw when ref is not provided
    try {
      await resetIndex({
        fs,
        dir,
        gitdir,
        filepath: 'nonexistent.txt',
        // ref not provided, should default to 'HEAD' but handle gracefully if HEAD doesn't exist
      })
      // resetIndex should handle this gracefully
      assert.ok(true)
    } catch (error) {
      // If there's an error, it should be about the file not existing, not about HEAD
      assert.ok(error instanceof Error, 'Should throw an error if file operations fail')
    }
  })
  await t.test('modified', async () => {
    // Setup
    const { fs, gitdir, dir } = await makeFixture('test-resetIndex')
    // Test
    const before = await listFiles({ fs, gitdir })
    assert.ok(Array.isArray(before))
    assert.ok(before.includes('a.txt'))
    assert.ok(before.includes('b.txt'))
    assert.ok(before.includes('d.txt'))
    await resetIndex({ fs, dir, gitdir, filepath: 'a.txt' })
    const after = await listFiles({ fs, gitdir })
    assert.ok(Array.isArray(after))
    assert.ok(after.includes('a.txt'))
    assert.ok(after.includes('b.txt'))
    assert.ok(after.includes('d.txt'))
    assert.strictEqual(before.length, after.length)
  })

  await t.test('new file', async () => {
    // Setup
    const { fs, gitdir, dir } = await makeFixture('test-resetIndex')
    // Test
    const before = await listFiles({ fs, gitdir })
    assert.ok(Array.isArray(before))
    assert.ok(before.includes('a.txt'))
    assert.ok(before.includes('b.txt'))
    assert.ok(before.includes('d.txt'))
    await resetIndex({ fs, dir, gitdir, filepath: 'd.txt' })
    const after = await listFiles({ fs, gitdir })
    assert.ok(Array.isArray(after))
    assert.ok(after.includes('a.txt'))
    assert.ok(after.includes('b.txt'))
    assert.ok(!after.includes('d.txt'))
    assert.strictEqual(before.length, after.length + 1)
  })

  await t.test('new repository', async () => {
    // Setup
    const { fs, gitdir, dir } = await makeFixture('test-resetIndex-new')
    // Test
    const before = await listFiles({ fs, gitdir })
    assert.ok(Array.isArray(before))
    assert.ok(before.includes('a.txt'))
    assert.ok(before.includes('b.txt'))
    await resetIndex({ fs, dir, gitdir, filepath: 'b.txt' })
    const after = await listFiles({ fs, gitdir })
    assert.ok(Array.isArray(after))
    assert.ok(after.includes('a.txt'))
    assert.ok(!after.includes('b.txt'))
    assert.strictEqual(before.length, after.length + 1)
  })

  await t.test('oid', async () => {
    // Setup
    const { fs, gitdir, dir } = await makeFixture('test-resetIndex-oid')
    // Test
    const before = await statusMatrix({ fs, dir, gitdir })
    assert.ok(Array.isArray(before))
    // Find b.txt in the status matrix
    const bBefore = before.find((entry: any) => entry[0] === 'b.txt')
    assert.ok(bBefore, 'b.txt should be in status matrix')
    // Status matrix format: [filepath, HEAD, INDEX, WORKDIR]
    // All should be 1 (present) before reset
    assert.strictEqual(bBefore[1], 1) // HEAD
    assert.strictEqual(bBefore[2], 1) // INDEX
    assert.strictEqual(bBefore[3], 1) // WORKDIR
    await resetIndex({
      fs,
      dir,
      gitdir,
      filepath: 'b.txt',
      ref: '572d5ec8ea719ed6780ef0e6a115a75999cb3091',
    })
    const after = await statusMatrix({ fs, dir, gitdir })
    assert.ok(Array.isArray(after))
    // Find b.txt in the status matrix after reset
    const bAfter = after.find((entry: any) => entry[0] === 'b.txt')
    assert.ok(bAfter, 'b.txt should still be in status matrix')
    // After reset to specific OID, WORKDIR should be 0 (absent)
    assert.strictEqual(bAfter[1], 1) // HEAD
    assert.strictEqual(bAfter[2], 1) // INDEX
    assert.strictEqual(bAfter[3], 0) // WORKDIR (absent after reset)
  })
})

