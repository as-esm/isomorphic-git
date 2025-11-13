import { test } from 'node:test'
import assert from 'node:assert'
import * as path from 'path'
import { Errors, branch, init, currentBranch, listFiles } from 'isomorphic-git'
import { makeFixture } from './helpers/fixture.ts'

test('branch', async (t) => {
  await t.test('branch', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-branch')
    // Test
    await branch({ fs, dir, gitdir, ref: 'test-branch' })
    const files = await fs.readdir(path.resolve(gitdir, 'refs', 'heads'))
    assert.deepStrictEqual(files, ['master', 'test-branch'])
    assert.strictEqual(await currentBranch({ fs, dir, gitdir }), 'master')
  })

  await t.test('branch with start point', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-branch-start-point')
    // Test
    let files = await fs.readdir(path.resolve(gitdir, 'refs', 'heads'))
    assert.deepStrictEqual(files, ['main', 'start-point'])
    await branch({ fs, dir, gitdir, ref: 'test-branch', object: 'start-point' })
    files = await fs.readdir(path.resolve(gitdir, 'refs', 'heads'))
    assert.deepStrictEqual(files, ['main', 'start-point', 'test-branch'])
    assert.strictEqual(await currentBranch({ fs, dir, gitdir }), 'main')
    assert.strictEqual(
      await fs.read(
        path.resolve(gitdir, 'refs', 'heads', 'test-branch'),
        'utf8'
      ),
      await fs.read(
        path.resolve(gitdir, 'refs', 'heads', 'start-point'),
        'utf8'
      )
    )
    assert.deepStrictEqual(await listFiles({ fs, dir, gitdir, ref: 'HEAD' }), [
      'new-file.txt',
    ])
    assert.deepStrictEqual(await listFiles({ fs, dir, gitdir, ref: 'test-branch' }), [])
  })

  await t.test('branch force', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-branch')
    let error: unknown = null
    // Test
    await branch({ fs, dir, gitdir, ref: 'test-branch' })
    assert.strictEqual(await currentBranch({ fs, dir, gitdir }), 'master')
    assert.ok(await fs.exists(path.resolve(gitdir, 'refs/heads/test-branch')))
    try {
      await branch({ fs, dir, gitdir, ref: 'test-branch', force: true })
    } catch (err) {
      error = err
    }
    assert.strictEqual(error, null)
  })

  await t.test('branch with start point force', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-branch-start-point')
    let error: unknown = null
    // Test
    await branch({ fs, dir, gitdir, ref: 'test-branch', object: 'start-point' })
    assert.strictEqual(await currentBranch({ fs, dir, gitdir }), 'main')
    assert.ok(await fs.exists(path.resolve(gitdir, 'refs/heads/test-branch')))
    try {
      await branch({ fs, dir, gitdir, ref: 'test-branch', force: true })
    } catch (err) {
      error = err
    }
    assert.strictEqual(error, null)
    assert.deepStrictEqual(await listFiles({ fs, dir, gitdir, ref: 'test-branch' }), [
      'new-file.txt',
    ])
  })

  await t.test('branch --checkout', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-branch')
    // Test
    await branch({ fs, dir, gitdir, ref: 'test-branch', checkout: true })
    assert.strictEqual(await currentBranch({ fs, dir, gitdir }), 'test-branch')
  })

  await t.test('invalid branch name', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-branch')
    let error: unknown = null
    // Test
    try {
      await branch({ fs, dir, gitdir, ref: 'inv@{id..branch.lock' })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.InvalidRefNameError)
  })

  await t.test('missing ref argument', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-branch')
    let error: unknown = null
    // Test
    try {
      // @ts-expect-error - testing missing parameter
      await branch({ fs, dir, gitdir })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.MissingParameterError)
  })

  await t.test('empty repo', async () => {
    // Setup
    const { dir, fs, gitdir } = await makeFixture('test-branch-empty-repo')
    await init({ fs, dir, gitdir })
    let error: unknown = null
    // Test
    try {
      await branch({ fs, dir, gitdir, ref: 'test-branch', checkout: true })
    } catch (err) {
      error = err
    }
    assert.strictEqual(error, null)
    const file = await fs.read(path.resolve(gitdir, 'HEAD'), 'utf8')
    assert.strictEqual(file, `ref: refs/heads/test-branch\n`)
  })

  await t.test('create branch with same name as a remote', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-branch')
    let error: unknown = null
    // Test
    try {
      await branch({ fs, dir, gitdir, ref: 'origin' })
    } catch (err) {
      error = err
    }
    assert.strictEqual(error, null)
    assert.ok(await fs.exists(path.resolve(gitdir, 'refs/heads/origin')))
  })

  await t.test('create branch named "HEAD"', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-branch')
    let error: unknown = null
    // Test
    try {
      await branch({ fs, dir, gitdir, ref: 'HEAD' })
    } catch (err) {
      error = err
    }
    assert.strictEqual(error, null)
    assert.ok(await fs.exists(path.resolve(gitdir, 'refs/heads/HEAD')))
  })
})

