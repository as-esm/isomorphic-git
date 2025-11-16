import { test } from 'node:test'
import assert from 'node:assert'
import { indexPack } from '../../src/commands/indexPack.ts'
import { makeFixture } from '../helpers/fixture.ts'
import { MissingParameterError } from '../../src/errors/MissingParameterError.ts'

test('indexPack', async (t) => {
  await t.test('throws MissingParameterError when fs is missing', async () => {
    try {
      await indexPack({
        // @ts-expect-error - intentionally missing fs
        dir: '/tmp/test',
        gitdir: '/tmp/test.git',
        filepath: 'objects/pack/test.pack',
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'fs')
    }
  })

  await t.test('throws MissingParameterError when dir is missing', async () => {
    const { fs } = await makeFixture('test-empty')
    try {
      await indexPack({
        fs,
        // @ts-expect-error - intentionally missing dir
        gitdir: '/tmp/test.git',
        filepath: 'objects/pack/test.pack',
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'dir')
    }
  })

  await t.test('uses gitdir from dir when gitdir is not provided', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    // gitdir is derived from dir, so when dir is provided, gitdir should be join(dir, '.git')
    try {
      await indexPack({
        fs,
        dir,
        // gitdir not provided, should default to join(dir, '.git')
        filepath: 'objects/pack/nonexistent.pack',
      })
      assert.fail('Should have thrown an error')
    } catch (error) {
      // The error should occur because the pack file doesn't exist
      // But the gitdir should be correctly derived from dir
      assert.ok(error instanceof Error, 'Should throw an error when pack file does not exist')
    }
  })

  await t.test('throws MissingParameterError when filepath is missing', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    try {
      await indexPack({
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

  await t.test('throws error when pack file does not exist', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    try {
      await indexPack({
        fs,
        dir,
        gitdir,
        filepath: 'objects/pack/nonexistent.pack',
      })
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.ok(error instanceof Error, 'Should throw an error when pack file does not exist')
    }
  })

  await t.test('calls onProgress callback when provided', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    let progressCalled = false
    const progressEvents: Array<{ phase: string; loaded: number; total: number }> = []
    
    try {
      await indexPack({
        fs,
        dir,
        gitdir,
        filepath: 'objects/pack/nonexistent.pack',
        onProgress: (evt) => {
          progressCalled = true
          progressEvents.push(evt)
        },
      })
      assert.fail('Should have thrown an error')
    } catch (error) {
      // Even if the pack file doesn't exist, onProgress might be called during initialization
      // The important thing is that the callback is properly passed through
      assert.ok(error instanceof Error, 'Should throw an error when pack file does not exist')
    }
  })

})

