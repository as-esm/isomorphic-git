import { test } from 'node:test'
import assert from 'node:assert'
import { resolveRef, init, commit, add, writeRef } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'
import { MissingParameterError } from '../../src/errors/MissingParameterError.ts'
import { NotFoundError } from '../../src/errors/NotFoundError.ts'

test('resolveRef', async (t) => {
  await t.test('throws MissingParameterError when fs is missing', async () => {
    try {
      await resolveRef({
        // @ts-expect-error - intentionally missing fs
        gitdir: '/tmp/test.git',
        ref: 'HEAD',
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'fs')
    }
  })

  await t.test('throws error when gitdir is missing and dir is not provided', async () => {
    const { fs } = await makeFixture('test-empty')
    try {
      await resolveRef({
        fs,
        // @ts-expect-error - intentionally missing both gitdir and dir
        ref: 'HEAD',
      } as any)
      assert.fail('Should have thrown an error')
    } catch (error) {
      // gitdir is derived from dir, so when both are missing, it will fail
      assert.ok(error instanceof Error, 'Should throw an error')
      if (error instanceof MissingParameterError) {
        assert.strictEqual((error as any).data?.parameter, 'gitdir')
      }
    }
  })

  await t.test('throws MissingParameterError when ref is missing', async () => {
    const { fs, gitdir } = await makeFixture('test-empty')
    try {
      await resolveRef({
        fs,
        gitdir,
        // @ts-expect-error - intentionally missing ref
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'ref')
    }
  })

  await t.test('resolves ref when it exists', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Create a ref directly
    const testOid = 'a'.repeat(40)
    await writeRef({ fs, gitdir, ref: 'refs/heads/test-branch', value: testOid })
    
    const resolved = await resolveRef({ fs, gitdir, ref: 'refs/heads/test-branch' })
    assert.strictEqual(resolved, testOid, 'Should resolve ref to the OID')
  })

  await t.test('throws NotFoundError when ref does not exist', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    try {
      await resolveRef({ fs, gitdir, ref: 'refs/heads/nonexistent' })
      assert.fail('Should have thrown NotFoundError')
    } catch (error) {
      assert.ok(error instanceof NotFoundError, 'Should throw NotFoundError for non-existent ref')
    }
  })

  await t.test('uses gitdir from dir when gitdir is not provided', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    const gitdir = `${dir}/.git`
    
    // Create a ref directly
    const testOid = 'a'.repeat(40)
    await writeRef({ fs, gitdir, ref: 'refs/heads/test-branch', value: testOid })
    
    // Resolve using dir only (gitdir should be derived)
    const resolved = await resolveRef({ fs, dir, ref: 'refs/heads/test-branch' })
    assert.strictEqual(resolved, testOid, 'Should resolve ref using derived gitdir')
  })

  await t.test('handles depth parameter', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Create refs directly
    const mainOid = 'a'.repeat(40)
    await writeRef({ fs, gitdir, ref: 'refs/heads/main', value: mainOid })
    
    // Create a symbolic ref pointing to main
    await writeRef({ fs, gitdir, ref: 'refs/heads/test', value: 'refs/heads/main' })
    
    // Resolve with depth
    const resolved = await resolveRef({ fs, gitdir, ref: 'refs/heads/test', depth: 1 })
    // Should resolve through the symbolic ref
    assert.ok(resolved, 'Should resolve symbolic ref with depth')
    assert.strictEqual(resolved, mainOid, 'Should resolve symbolic ref with depth to main OID')
  })
})

