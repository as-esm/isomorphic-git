import { test } from 'node:test'
import assert from 'node:assert'
import { currentBranch } from 'isomorphic-git'
import { makeFixture } from './helpers/fixture.ts'

test('currentBranch', async (t) => {
  await t.test('resolve HEAD to master', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-resolveRef')
    // Test
    const branch = await currentBranch({ fs, gitdir })
    assert.strictEqual(branch, 'master')
  })

  await t.test('resolve HEAD to refs/heads/master', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-resolveRef')
    // Test
    const branch = await currentBranch({
      fs,
      gitdir,
      fullname: true,
    })
    assert.strictEqual(branch, 'refs/heads/master')
  })

  await t.test('returns undefined if HEAD is detached', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-detachedHead')
    // Test
    const branch = await currentBranch({ fs, gitdir })
    assert.strictEqual(branch, undefined)
  })
})

