import { test } from 'node:test'
import assert from 'node:assert'
import { Errors, deleteTag, listTags } from 'isomorphic-git'
import { makeFixture } from './helpers/fixture.ts'

test('deleteTag', async (t) => {
  await t.test('deletes the latest tag to HEAD', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-deleteTag')
    // Test
    await deleteTag({
      fs,
      gitdir,
      ref: 'latest',
    })
    const refs = await listTags({
      fs,
      gitdir,
    })
    assert.deepStrictEqual(refs, ['prev'])
  })

  await t.test('missing ref argument', async () => {
    // Setup
    const { dir, gitdir } = await makeFixture('test-deleteTag')
    let error = null
    // Test
    try {
      // @ts-expect-error - testing missing parameter
      await deleteTag({ dir, gitdir })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.MissingParameterError)
  })
})

