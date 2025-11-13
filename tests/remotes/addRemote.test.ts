import { test } from 'node:test'
import assert from 'node:assert'
import { Errors, addRemote, listRemotes } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

test('addRemote', async (t) => {
  await t.test('addRemote', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-addRemote')
    const remote = 'baz'
    const url = 'git@github.com:baz/baz.git'
    // Test
    await addRemote({ fs, dir, gitdir, remote, url })
    const a = await listRemotes({ fs, dir, gitdir })
    assert.deepStrictEqual(a, [
      { remote: 'foo', url: 'git@github.com:foo/foo.git' },
      { remote: 'bar', url: 'git@github.com:bar/bar.git' },
      { remote: 'baz', url: 'git@github.com:baz/baz.git' },
    ])
  })

  await t.test('missing argument', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-addRemote')
    const remote = 'baz'
    const url = undefined
    // Test
    let error: unknown = null
    try {
      await addRemote({
        fs,
        dir,
        gitdir,
        remote,
        // @ts-expect-error - testing missing parameter
        url,
      })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.MissingParameterError)
  })

  await t.test('invalid remote name', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-addRemote')
    const remote = '@{HEAD~1}'
    const url = 'git@github.com:baz/baz.git'
    // Test
    let error: unknown = null
    try {
      await addRemote({ fs, dir, gitdir, remote, url })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.InvalidRefNameError)
  })
})

