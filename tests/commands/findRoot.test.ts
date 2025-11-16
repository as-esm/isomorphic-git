import { test } from 'node:test'
import assert from 'node:assert'
import { findRoot, init } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'
import { MissingParameterError } from '../../src/errors/MissingParameterError.ts'
import { NotFoundError } from '../../src/errors/NotFoundError.ts'

test('findRoot', async (t) => {
  await t.test('throws MissingParameterError when fs is missing', async () => {
    try {
      await findRoot({
        // @ts-expect-error - intentionally missing fs
        filepath: '/tmp/test',
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'fs')
    }
  })

  await t.test('throws MissingParameterError when filepath is missing', async () => {
    const { fs } = await makeFixture('test-empty')
    try {
      await findRoot({
        fs,
        // @ts-expect-error - intentionally missing filepath
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'filepath')
    }
  })

  await t.test('finds root directory when starting from root', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    const root = await findRoot({ fs, filepath: dir })
    assert.strictEqual(root, dir, 'Should return the root directory')
  })

  await t.test('finds root directory when starting from subdirectory', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Create a subdirectory - ensure parent directories exist first
    const subdirPath = `${dir}/subdir`
    const nestedPath = `${subdirPath}/nested`
    try {
      await fs.mkdir(subdirPath)
      await fs.mkdir(nestedPath)
    } catch {
      // Directories might already exist, that's fine
    }
    
    const root = await findRoot({ fs, filepath: nestedPath })
    assert.strictEqual(root, dir, 'Should find root directory from subdirectory')
  })

  await t.test('throws NotFoundError when no git repository found', async () => {
    const { fs } = await makeFixture('test-empty')
    // Don't initialize git, just use a temporary directory
    
    try {
      await findRoot({ fs, filepath: '/tmp/nonexistent' })
      assert.fail('Should have thrown NotFoundError')
    } catch (error) {
      assert.ok(error instanceof NotFoundError, 'Should throw NotFoundError when no git root found')
    }
  })

  await t.test('finds root directory when starting from .git directory', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    const root = await findRoot({ fs, filepath: `${dir}/.git` })
    assert.strictEqual(root, dir, 'Should return the root directory even when starting from .git')
  })
})

