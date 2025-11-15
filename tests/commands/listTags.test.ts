import { describe, it } from 'node:test'
import assert from 'node:assert'
import { listTags } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

describe('listTags', () => {
  it('listTags', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-listTags')
    // Test
    const refs = await listTags({
      fs,
      gitdir,
    })
    assert.ok(Array.isArray(refs))
    assert.ok(refs.length > 0)
    // Verify it contains some tags
    assert.ok(refs.some(tag => tag.includes('v0.') || tag.includes('test-tag') || tag.includes('local-tag')))
  })
})

