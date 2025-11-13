import { test } from 'node:test'
import assert from 'node:assert'
import { Errors, deleteRemote, listRemotes } from 'isomorphic-git'
import { makeFixture } from './helpers/fixture.ts'

test('deleteRemote', async (t) => {
  await t.test('deleteRemote', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-deleteRemote')
    const remote = 'foo'
    // Test
    await deleteRemote({ fs, dir, gitdir, remote })
    const a = await listRemotes({ fs, dir, gitdir })
    assert.deepStrictEqual(a, [{ remote: 'bar', url: 'git@github.com:bar/bar.git' }])
  })

  await t.test('missing argument', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-addRemote')
    // Test
    let error = null
    try {
      // @ts-expect-error - testing missing parameter
      await deleteRemote({ fs, dir, gitdir })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.MissingParameterError)
  })
})

