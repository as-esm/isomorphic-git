import { test } from 'node:test'
import assert from 'node:assert'
import { Errors, tag, resolveRef } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

test('tag', async (t) => {
  await t.test('creates a lightweight tag to HEAD', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-tag')
    // Test
    await tag({ fs, gitdir, ref: 'latest' })
    const ref = await resolveRef({ fs, gitdir, ref: 'refs/tags/latest' })
    assert.strictEqual(ref, 'cfc039a0acb68bee8bb4f3b13b6b211dbb8c1a69')
  })

  await t.test('fails if tag already exists', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-tag')
    // Test
    let error = null
    try {
      await tag({ fs, gitdir, ref: 'existing-tag' })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.AlreadyExistsError)
  })

  await t.test('fails if tag already exists (packed)', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-tag')
    // Test
    let error = null
    try {
      await tag({ fs, gitdir, ref: 'packed-tag' })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.AlreadyExistsError)
  })

  await t.test('force overwrite', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-tag')
    // Test
    let error = null
    try {
      await tag({ fs, gitdir, ref: 'existing-tag', force: true })
    } catch (err) {
      error = err
    }
    assert.strictEqual(error, null)
  })

  await t.test('force overwrite (packed)', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-tag')
    // Test
    let error = null
    try {
      await tag({ fs, gitdir, ref: 'packed-tag', force: true })
    } catch (err) {
      error = err
    }
    assert.strictEqual(error, null)
  })
})

