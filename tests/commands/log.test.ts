import { describe, it } from 'node:test'
import assert from 'node:assert'
import { log } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

describe('log', () => {
  it('HEAD', async () => {
    const { fs, gitdir } = await makeFixture('test-log')
    const commits = await log({ fs, gitdir, ref: 'HEAD' })
    assert.strictEqual(commits.length, 5)
    // Verify commit structure
    commits.forEach(commit => {
      assert.ok(commit.oid)
      assert.ok(commit.commit)
      assert.ok(commit.commit.author)
      assert.ok(commit.commit.committer)
      assert.ok(commit.commit.message)
      assert.ok(Array.isArray(commit.commit.parent))
      assert.ok(commit.commit.tree)
    })
  })
})

