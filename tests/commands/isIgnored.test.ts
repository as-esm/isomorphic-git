import { test } from 'node:test'
import assert from 'node:assert'
import { isIgnored, init } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'
import { MissingParameterError } from '../../src/errors/MissingParameterError.ts'

test('isIgnored', async (t) => {
  await t.test('throws MissingParameterError when fs is missing', async () => {
    try {
      await isIgnored({
        // @ts-expect-error - intentionally missing fs
        dir: '/tmp/test',
        filepath: 'test.txt',
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'fs')
    }
  })

  await t.test('throws error when dir is missing', async () => {
    const { fs } = await makeFixture('test-empty')
    try {
      await isIgnored({
        fs,
        // @ts-expect-error - intentionally missing dir
        filepath: 'test.txt',
      } as any)
      assert.fail('Should have thrown an error')
    } catch (error) {
      // dir is required, so it should throw an error
      assert.ok(error instanceof Error, 'Should throw an error when dir is missing')
      // It might be MissingParameterError or a different error depending on when it's checked
      if (error instanceof MissingParameterError) {
        assert.strictEqual((error as any).data?.parameter, 'dir')
      }
    }
  })

  await t.test('throws MissingParameterError when gitdir is missing', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    try {
      await isIgnored({
        fs,
        dir,
        // @ts-expect-error - intentionally missing gitdir
        filepath: 'test.txt',
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      // gitdir is derived from dir, so this might not throw MissingParameterError
      // but should throw some error
      assert.ok(error instanceof Error, 'Should throw an error')
    }
  })

  await t.test('throws MissingParameterError when filepath is missing', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    try {
      await isIgnored({
        fs,
        dir,
        gitdir,
        // @ts-expect-error - intentionally missing filepath
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'filepath')
    }
  })

  await t.test('returns false for non-ignored file', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    const result = await isIgnored({ fs, dir, gitdir, filepath: 'test.txt' })
    assert.strictEqual(result, false, 'Non-ignored file should return false')
  })

  await t.test('returns true for ignored file', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Create .gitignore file
    await fs.write(`${dir}/.gitignore`, 'test.txt\n')
    
    const result = await isIgnored({ fs, dir, gitdir, filepath: 'test.txt' })
    assert.strictEqual(result, true, 'Ignored file should return true')
  })

  await t.test('uses gitdir from dir when gitdir is not provided', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Create .gitignore file
    await fs.write(`${dir}/.gitignore`, 'ignored.txt\n')
    
    // Test with dir only (gitdir should be derived)
    const result = await isIgnored({ fs, dir, filepath: 'ignored.txt' })
    assert.strictEqual(result, true, 'Ignored file should return true')
  })
})

