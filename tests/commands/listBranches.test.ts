import { describe, it } from 'node:test'
import assert from 'node:assert'
import { listBranches } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

describe('listBranches', () => {
  it('listBranches', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-listBranches')
    // Test
    const branches = await listBranches({ fs, gitdir })
    assert.ok(Array.isArray(branches))
    assert.ok(branches.length > 0)
    // Check some expected branches
    assert.ok(branches.includes('master') || branches.includes('main') || branches.includes('test-branch'))
  })
  
  it('remote', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-listBranches')
    // Test
    const branches = await listBranches({
      fs,
      gitdir,
      remote: 'origin',
    })
    assert.ok(Array.isArray(branches))
    assert.ok(branches.length > 0)
  })
})

