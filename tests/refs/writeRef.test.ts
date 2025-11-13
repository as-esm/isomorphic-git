import { test } from 'node:test'
import assert from 'node:assert'
import { writeRef, resolveRef, currentBranch } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

test('writeRef', async (t) => {
  await t.test('writes a tag ref to HEAD', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-writeRef')
    // Test
    await writeRef({
      fs,
      gitdir,
      ref: 'refs/tags/latest',
      value: 'cfc039a0acb68bee8bb4f3b13b6b211dbb8c1a69',
    })
    const ref = await resolveRef({ fs, gitdir, ref: 'refs/tags/latest' })
    assert.strictEqual(ref, 'cfc039a0acb68bee8bb4f3b13b6b211dbb8c1a69')
  })

  await t.test('sets current branch to another', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-writeRef')
    // Test
    await writeRef({
      fs,
      gitdir,
      ref: 'refs/heads/another',
      value: 'HEAD',
    })
    await writeRef({
      fs,
      gitdir,
      ref: 'HEAD',
      value: 'refs/heads/another',
      force: true,
      symbolic: true,
    })
    const newBranch = await currentBranch({ fs, gitdir, fullname: true })
    assert.strictEqual(newBranch, 'refs/heads/another')
    if (!newBranch) throw new Error('type error')
    const ref = await resolveRef({ fs, gitdir, ref: newBranch })
    assert.strictEqual(ref, 'cfc039a0acb68bee8bb4f3b13b6b211dbb8c1a69')
  })
})

