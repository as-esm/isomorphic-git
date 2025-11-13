import { test } from 'node:test'
import assert from 'node:assert'
import { listRemotes } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

test('listRemotes', async (t) => {
  await t.test('listRemotes', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-listRemotes')
    // Test
    const a = await listRemotes({ fs, dir, gitdir })
    assert.deepStrictEqual(a, [
      { remote: 'foo', url: 'git@github.com:foo/foo.git' },
      { remote: 'bar', url: 'git@github.com:bar/bar.git' },
    ])
  })
})

