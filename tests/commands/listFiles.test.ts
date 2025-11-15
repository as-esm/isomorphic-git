import { describe, it } from 'node:test'
import assert from 'node:assert'
import { listFiles } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

describe('listFiles', () => {
  it('index', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-listFiles')
    // Test
    const files = await listFiles({ fs, gitdir })
    // Verify it returns an array with files
    assert.ok(Array.isArray(files))
    assert.ok(files.length > 0)
    // Check some expected files are present
    assert.ok(files.includes('.babelrc') || files.includes('README.md') || files.includes('package.json'))
  })
  
  it('ref', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-checkout')
    // Test
    const files = await listFiles({ fs, gitdir, ref: 'test-branch' })
    // Verify it returns an array with files
    assert.ok(Array.isArray(files))
    assert.ok(files.length > 0)
  })
})

