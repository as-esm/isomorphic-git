import { describe, it } from 'node:test'
import assert from 'node:assert'
import { remove, listFiles } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

describe('remove', () => {
  it('file', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-remove')
    // Test
    const before = await listFiles({ fs, gitdir })
    assert.ok(before.length > 0)
    assert.ok(before.includes('LICENSE.md'))
    await remove({ fs, gitdir, filepath: 'LICENSE.md' })
    const after = await listFiles({ fs, gitdir })
    assert.strictEqual(before.length, after.length + 1)
    assert.ok(!after.includes('LICENSE.md'))
  })
  
  it('dir', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-remove')
    // Test
    const before = await listFiles({ fs, gitdir })
    assert.ok(before.length > 0)
    await remove({ fs, gitdir, filepath: 'src' })
    const after = await listFiles({ fs, gitdir })
    // All files in src directory should be removed
    const srcFiles = before.filter(f => f.startsWith('src/'))
    assert.strictEqual(before.length, after.length + srcFiles.length)
  })
})

