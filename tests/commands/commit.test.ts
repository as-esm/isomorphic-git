import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import * as path from 'path'
import {
  Errors,
  readCommit,
  commit,
  log,
  resolveRef,
  init,
  add,
} from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'
import { readLog } from '../../src/git/logs/readLog.ts'

describe('commit', () => {
  // CRITICAL: Use a shared cache object for ALL git commands in these tests
  // This ensures state modifications (like index updates) are immediately
  // visible to subsequent commands, eliminating race conditions
  let cache: Record<string, unknown>

  beforeEach(() => {
    cache = {} // Reset the cache for each test
  })
  it('prevent commit if index has unmerged paths', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-GitIndex-unmerged')
    // Test
    let error = null
    try {
      await commit({
        fs,
        gitdir,
        author: {
          name: 'Mr. Test',
          email: 'mrtest@example.com',
          timestamp: 1262356920,
          timezoneOffset: -0,
        },
        message: 'Initial commit',
        cache,
      })
    } catch (e) {
      error = e
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.UnmergedPathsError || error.code === Errors.UnmergedPathsError.code || error.name === 'UnmergedPathsError')
  })
  
  it('commit', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-commit')
    const { oid: originalOid } = (await log({ fs, gitdir, depth: 1, cache }))[0]
    // Test
    const author = {
      name: 'Mr. Test',
      email: 'mrtest@example.com',
      timestamp: 1262356920,
      timezoneOffset: -0,
    }
    const sha = await commit({
      fs,
      gitdir,
      author,
      message: 'Initial commit',
    })
    assert.strictEqual(sha, '7a51c0b1181d738198ff21c4679d3aa32eb52fe0')
    // updates branch pointer
    const { oid: currentOid, commit: currentCommit } = (
      await log({ fs, gitdir, depth: 1, cache })
    )[0]
    assert.deepStrictEqual(currentCommit.parent, [originalOid])
    assert.deepStrictEqual(currentCommit.author, author)
    assert.deepStrictEqual(currentCommit.committer, author)
    assert.strictEqual(currentCommit.message, 'Initial commit\n')
    assert.notStrictEqual(currentOid, originalOid)
    assert.strictEqual(currentOid, sha)
    
    // Verify reflog entry was created
    const reflogEntries = await readLog({ fs, gitdir, ref: 'refs/heads/master', parsed: true })
    assert.ok(reflogEntries.length > 0, 'Reflog should have at least one entry')
    const lastEntry = reflogEntries[reflogEntries.length - 1] as { oldOid: string; newOid: string; message: string }
    assert.strictEqual(lastEntry.oldOid, originalOid)
    assert.strictEqual(lastEntry.newOid, sha)
    assert.ok(lastEntry.message.includes('Initial commit'), 'Reflog message should contain commit message')
  })

  it('Initial commit', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-init')
    await init({ fs, dir })
    await fs.write(path.join(dir, 'hello.md'), 'Hello, World!')
    await add({ fs, dir, filepath: 'hello.md', cache })

    // Test
    const author = {
      name: 'Mr. Test',
      email: 'mrtest@example.com',
      timestamp: 1262356920,
      timezoneOffset: -0,
    }

    await commit({
      fs,
      dir,
      author,
      message: 'Initial commit',
      cache,
    })

    const commits = await log({ fs, dir, cache })
    assert.strictEqual(commits.length, 1)
    assert.deepStrictEqual(commits[0].commit.parent, [])
    assert.strictEqual(await resolveRef({ fs, dir, ref: 'HEAD', cache }), commits[0].oid)
  })

  it('Cannot commit without message', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-commit')
    // Test
    const author = {
      name: 'Mr. Test',
      email: 'mrtest@example.com',
      timestamp: 1262356920,
      timezoneOffset: -0,
    }

    let error = null

    try {
      await commit({
        fs,
        gitdir,
        author,
      })
    } catch (err) {
      error = err
    }

    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.MissingParameterError)
  })

  it('without updating branch', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-commit')
    const { oid: originalOid } = (await log({ fs, gitdir, depth: 1, cache }))[0]
    // Test
    const sha = await commit({
      fs,
      gitdir,
      author: {
        name: 'Mr. Test',
        email: 'mrtest@example.com',
        timestamp: 1262356920,
        timezoneOffset: -0,
      },
      message: 'Initial commit',
      noUpdateBranch: true,
    })
    assert.strictEqual(sha, '7a51c0b1181d738198ff21c4679d3aa32eb52fe0')
    // does NOT update branch pointer
    const { oid: currentOid } = (await log({ fs, gitdir, depth: 1, cache }))[0]
    assert.strictEqual(currentOid, originalOid)
    assert.notStrictEqual(currentOid, sha)
    // but DID create commit object
    assert.strictEqual(
      await fs.exists(
        `${gitdir}/objects/7a/51c0b1181d738198ff21c4679d3aa32eb52fe0`
      ),
      true
    )
  })

  it('dry run', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-commit')
    const { oid: originalOid } = (await log({ fs, gitdir, depth: 1, cache }))[0]
    // Test
    const sha = await commit({
      fs,
      gitdir,
      author: {
        name: 'Mr. Test',
        email: 'mrtest@example.com',
        timestamp: 1262356920,
        timezoneOffset: -0,
      },
      message: 'Initial commit',
      dryRun: true,
    })
    assert.strictEqual(sha, '7a51c0b1181d738198ff21c4679d3aa32eb52fe0')
    // does NOT update branch pointer
    const { oid: currentOid } = (await log({ fs, gitdir, depth: 1, cache }))[0]
    assert.strictEqual(currentOid, originalOid)
    assert.notStrictEqual(currentOid, sha)
    // and did NOT create commit object
    assert.strictEqual(
      await fs.exists(
        `${gitdir}/objects/7a/51c0b1181d738198ff21c4679d3aa32eb52fe0`
      ),
      false
    )
  })

  it('custom ref', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-commit')
    const { oid: originalOid } = (await log({ fs, gitdir, depth: 1, cache }))[0]
    // Test
    const sha = await commit({
      fs,
      gitdir,
      author: {
        name: 'Mr. Test',
        email: 'mrtest@example.com',
        timestamp: 1262356920,
        timezoneOffset: -0,
      },
      message: 'Initial commit',
      ref: 'refs/heads/master-copy',
    })
    assert.strictEqual(sha, '7a51c0b1181d738198ff21c4679d3aa32eb52fe0')
    // does NOT update master branch pointer
    const { oid: currentOid } = (await log({ fs, gitdir, depth: 1, cache }))[0]
    assert.strictEqual(currentOid, originalOid)
    assert.notStrictEqual(currentOid, sha)
    // but DOES update master-copy
    const { oid: copyOid } = (
      await log({
        fs,
        gitdir,
        depth: 1,
        ref: 'master-copy',
        cache,
      })
    )[0]
    assert.strictEqual(sha, copyOid)
  })

  it('custom parents and tree', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-commit')
    const { oid: originalOid } = (await log({ fs, gitdir, depth: 1, cache }))[0]
    // Test
    const parent = [
      '1111111111111111111111111111111111111111',
      '2222222222222222222222222222222222222222',
      '3333333333333333333333333333333333333333',
    ]
    const tree = '4444444444444444444444444444444444444444'
    const sha = await commit({
      fs,
      gitdir,
      parent,
      tree,
      author: {
        name: 'Mr. Test',
        email: 'mrtest@example.com',
        timestamp: 1262356920,
        timezoneOffset: -0,
      },
      message: 'Initial commit',
    })
    assert.strictEqual(sha, '43fbc94f2c1db655a833e08c72d005954ff32f32')
    // does NOT update master branch pointer
    const { parent: parents, tree: _tree } = (
      await log({
        fs,
        gitdir,
        depth: 1,
        cache,
      })
    )[0].commit
    assert.notDeepStrictEqual(parents, [originalOid])
    assert.deepStrictEqual(parents, parent)
    assert.strictEqual(_tree, tree)
  })

  it('throw error if missing author', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-commit')
    // Test
    // Use autoDetectConfig: false to ensure no global/system config is read
    // This makes the test hermetic and independent of the test environment
    let error = null
    try {
      await commit({
        fs,
        gitdir,
        author: {
          email: 'mrtest@example.com',
          timestamp: 1262356920,
          timezoneOffset: 0,
        },
        message: 'Initial commit',
        autoDetectConfig: false, // Disable auto-detection to ensure no user.name is found
      })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.strictEqual(error.code, Errors.MissingNameError.code)
  })

  it('with timezone', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-commit')
    let commits
    // Test
    await commit({
      fs,
      gitdir,
      author: {
        name: 'Mr. Test',
        email: 'mrtest@example.com',
        timestamp: 1262356920,
        timezoneOffset: -0,
      },
      message: '-0 offset',
    })
    commits = await log({ fs, gitdir, depth: 1, cache })
    assert.strictEqual(Object.is(commits[0].commit.author.timezoneOffset, -0), true)

    await commit({
      fs,
      gitdir,
      author: {
        name: 'Mr. Test',
        email: 'mrtest@example.com',
        timestamp: 1262356920,
        timezoneOffset: 0,
      },
      message: '+0 offset',
    })
    commits = await log({ fs, gitdir, depth: 1, cache })
    assert.strictEqual(Object.is(commits[0].commit.author.timezoneOffset, 0), true)

    await commit({
      fs,
      gitdir,
      author: {
        name: 'Mr. Test',
        email: 'mrtest@example.com',
        timestamp: 1262356920,
        timezoneOffset: 240,
      },
      message: '+240 offset',
    })
    commits = await log({ fs, gitdir, depth: 1, cache })
    assert.strictEqual(Object.is(commits[0].commit.author.timezoneOffset, 240), true)

    await commit({
      fs,
      gitdir,
      author: {
        name: 'Mr. Test',
        email: 'mrtest@example.com',
        timestamp: 1262356920,
        timezoneOffset: -240,
      },
      message: '-240 offset',
    })
    commits = await log({ fs, gitdir, depth: 1, cache })
    assert.strictEqual(
      Object.is(commits[0].commit.author.timezoneOffset, -240),
      true
    )
  })

  it('commit amend (new message)', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-commit')
    const author = {
      name: 'Mr. Test',
      email: 'mrtest@example.com',
      timestamp: 1262356920,
      timezoneOffset: -0,
    }
    await commit({
      fs,
      gitdir,
      author,
      message: 'Initial commit',
    })

    // Test
    const { oid: originalOid, commit: originalCommit } = (
      await log({ fs, gitdir, depth: 1, cache })
    )[0]
    await commit({
      fs,
      gitdir,
      message: 'Amended commit',
      amend: true,
    })
    const { oid: amendedOid, commit: amendedCommit } = (
      await log({ fs, gitdir, depth: 1, cache })
    )[0]

    assert.notStrictEqual(amendedOid, originalOid)
    assert.deepStrictEqual(amendedCommit.author, originalCommit.author)
    assert.deepStrictEqual(amendedCommit.committer, originalCommit.committer)
    assert.strictEqual(amendedCommit.message, 'Amended commit\n')
    assert.deepStrictEqual(amendedCommit.parent, originalCommit.parent)
    assert.strictEqual(await resolveRef({ fs, gitdir, ref: 'HEAD', cache }), amendedOid)
  })

  it('commit amend (change author, keep message)', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-commit')
    const author = {
      name: 'Mr. Test',
      email: 'mrtest@example.com',
      timestamp: 1262356920,
      timezoneOffset: -0,
    }
    await commit({
      fs,
      gitdir,
      author,
      message: 'Initial commit',
    })

    // Test
    const { oid: originalOid, commit: originalCommit } = (
      await log({ fs, gitdir, depth: 1, cache })
    )[0]

    const newAuthor = {
      name: 'Mr. Test 2',
      email: 'mrtest2@example.com',
      timestamp: 1262356921,
      timezoneOffset: -0,
    }
    await commit({
      fs,
      gitdir,
      author: newAuthor,
      amend: true,
    })
    const { oid: amendedOid, commit: amendedCommit } = (
      await log({ fs, gitdir, depth: 1, cache })
    )[0]

    assert.notStrictEqual(amendedOid, originalOid)
    assert.deepStrictEqual(amendedCommit.author, newAuthor)
    assert.deepStrictEqual(amendedCommit.committer, newAuthor)
    assert.strictEqual(amendedCommit.message, originalCommit.message)
    assert.deepStrictEqual(amendedCommit.parent, originalCommit.parent)
    assert.strictEqual(await resolveRef({ fs, gitdir, ref: 'HEAD', cache }), amendedOid)
  })

  it('Cannot amend without an initial commit', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-init')
    await init({ fs, dir })
    await fs.write(path.join(dir, 'hello.md'), 'Hello, World!')
    await add({ fs, dir, filepath: 'hello.md', cache })

    // Test
    const author = {
      name: 'Mr. Test',
      email: 'mrtest@example.com',
      timestamp: 1262356920,
      timezoneOffset: -0,
    }

    let error = null
    try {
      await commit({
        fs,
        dir,
        author,
        message: 'Initial commit',
        amend: true,
      })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.NoCommitError)
  })
})

