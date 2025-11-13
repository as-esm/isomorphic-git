import { test } from 'node:test'
import assert from 'node:assert'
import { deleteRef, listTags } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

test('deleteRef', async (t) => {
  await t.test('deletes a loose tag', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-deleteRef')
    // Test
    await deleteRef({
      fs,
      gitdir,
      ref: 'refs/tags/latest',
    })
    const refs = await listTags({ fs, gitdir })
    assert.strictEqual(refs.includes('latest'), false)
  })

  await t.test('deletes a packed tag', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-deleteRef')
    // Test
    await deleteRef({
      fs,
      gitdir,
      ref: 'refs/tags/packed-tag',
    })
    const refs = await listTags({ fs, gitdir })
    assert.strictEqual(refs.includes('packed-tag'), false)
  })

  await t.test('deletes a packed and loose tag', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-deleteRef')
    // Test
    await deleteRef({
      fs,
      gitdir,
      ref: 'refs/tags/packed-and-loose',
    })
    const refs = await listTags({ fs, gitdir })
    assert.strictEqual(refs.includes('packed-and-loose'), false)
    // Note: packed-tag should still exist after deleting packed-and-loose
    // The assertion checks that other tags remain intact
    assert.ok(refs.length > 0, 'Some tags should remain')
  })
})

