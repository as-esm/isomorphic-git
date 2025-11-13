import { test } from 'node:test'
import assert from 'node:assert'
import {
  Errors,
  deleteBranch,
  currentBranch,
  listBranches,
  listTags,
  getConfig,
} from 'isomorphic-git'
import { makeFixture } from './helpers/fixture.ts'

test('deleteBranch', async (t) => {
  await t.test('delete branch', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-deleteBranch')
    // Test
    await deleteBranch({ fs, gitdir, ref: 'test' })
    const branches = await listBranches({ fs, gitdir })
    assert.ok(!branches.includes('test'))
  })

  await t.test('deletes the branch when an identically named tag exists', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-deleteBranch')
    // Test
    await deleteBranch({ fs, gitdir, ref: 'collision' })
    const branches = await listBranches({ fs, gitdir })
    assert.ok(!branches.includes('collision'))
    const tags = await listTags({ fs, gitdir })
    assert.ok(tags.includes('collision'))
  })

  await t.test('branch not exist', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-deleteBranch')
    let error: unknown = null
    // Test
    try {
      await deleteBranch({ fs, gitdir, ref: 'branch-not-exist' })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.NotFoundError)
  })

  await t.test('missing ref argument', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-deleteBranch')
    let error: unknown = null
    // Test
    try {
      // @ts-expect-error - testing missing parameter
      await deleteBranch({ fs, gitdir })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.MissingParameterError)
  })

  await t.test('checked out branch', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-deleteBranch')
    // Test
    await deleteBranch({ fs, gitdir, ref: 'master' })
    const head = await currentBranch({ fs, gitdir })
    assert.strictEqual(head, undefined)
    const branches = await listBranches({ fs, gitdir })
    assert.ok(!branches.includes('master'))
  })

  await t.test('delete branch and its entry in config', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-deleteBranch')
    // Test
    await deleteBranch({ fs, gitdir, ref: 'remote' })
    const branches = await listBranches({ fs, gitdir })
    assert.ok(!branches.includes('remote'))
    assert.strictEqual(
      await getConfig({ fs, gitdir, path: 'branch.remote.remote' }),
      undefined
    )
    assert.strictEqual(
      await getConfig({ fs, gitdir, path: 'branch.remote.merge' }),
      undefined
    )
  })
})

