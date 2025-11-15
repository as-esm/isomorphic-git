import { describe, it } from 'node:test'
import assert from 'node:assert'
import { listRefs } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

describe('listRefs', () => {
  it('listRefs', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-listRefs')
    // Test
    const refs = await listRefs({
      fs,
      gitdir,
      filepath: 'refs/tags',
    })
    assert.ok(Array.isArray(refs))
    assert.ok(refs.length > 0)
    // Verify it contains some tag refs
    assert.ok(refs.some(ref => ref.includes('v0.') || ref.includes('test-tag') || ref.includes('local-tag')))
  })
})

