import { test } from 'node:test'
import assert from 'node:assert'
import * as path from 'path'
import { Errors, renameBranch, currentBranch } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

test('renameBranch', async (t) => {
  await t.test('branch already exists', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-renameBranch')
    let error = null
    // Test
    try {
      await renameBranch({
        fs,
        dir,
        gitdir,
        oldref: 'test-branch',
        ref: 'existing-branch',
      })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.AlreadyExistsError)
  })

  await t.test('invalid new branch name', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-renameBranch')
    let error = null
    // Test
    try {
      await renameBranch({
        fs,
        dir,
        gitdir,
        oldref: 'test-branch',
        ref: 'inv@{id..branch.lock',
      })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.InvalidRefNameError)
  })

  await t.test('invalid old branch name', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-renameBranch')
    let error = null
    // Test
    try {
      await renameBranch({
        fs,
        dir,
        gitdir,
        ref: 'other-branch',
        oldref: 'inv@{id..branch.lock',
      })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.InvalidRefNameError)
  })

  await t.test('missing ref argument', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-renameBranch')
    let error = null
    // Test
    try {
      // @ts-expect-error - testing missing parameter
      await renameBranch({ fs, dir, gitdir, oldref: 'test-branch' })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.MissingParameterError)
  })

  await t.test('missing oldref argument', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-renameBranch')
    let error = null
    // Test
    try {
      // @ts-expect-error - testing missing parameter
      await renameBranch({ fs, dir, gitdir, ref: 'other-branch' })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.MissingParameterError)
  })

  await t.test('rename branch', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-renameBranch')
    // Test
    await renameBranch({
      fs,
      dir,
      gitdir,
      oldref: 'test-branch',
      ref: 'other-branch',
    })
    const files = await fs.readdir(path.resolve(gitdir, 'refs', 'heads'))
    assert.strictEqual(files.includes('test-branch'), false)
    assert.strictEqual(await currentBranch({ fs, dir, gitdir }), 'master')
  })

  await t.test('rename branch and checkout', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-renameBranch')
    // Test
    await renameBranch({
      fs,
      dir,
      gitdir,
      oldref: 'test-branch-2',
      ref: 'other-branch-2',
      checkout: true,
    })
    assert.strictEqual(await currentBranch({ fs, dir, gitdir }), 'other-branch-2')
  })

  await t.test('rename current branch', async () => {
    // Setup
    const { fs, dir, gitdir } = await makeFixture('test-renameBranch')
    // Test
    await renameBranch({
      fs,
      dir,
      gitdir,
      oldref: 'master',
      ref: 'other-branch',
    })
    assert.strictEqual(await currentBranch({ fs, dir, gitdir }), 'other-branch')

    await renameBranch({
      fs,
      dir,
      gitdir,
      oldref: 'other-branch',
      ref: 'master',
    })
    assert.strictEqual(await currentBranch({ fs, dir, gitdir }), 'master')
  })
})

