import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import {
  stash,
  Errors,
  setConfig,
  add,
  status,
  commit,
  readCommit,
} from 'isomorphic-git'
import { makeFixture, resetToCommit } from '../helpers/fixture.ts'

const addUserConfig = async (fs: any, dir: string, gitdir: string) => {
  await setConfig({ fs, dir, gitdir, path: 'user.name', value: 'stash tester' })
  await setConfig({
    fs,
    dir,
    gitdir,
    path: 'user.email',
    value: 'test@stash.com',
  })
}

const stashChanges = async (
  fs: any,
  dir: string,
  gitdir: string,
  defalt = true,
  again = true,
  message = '',
  cache: Record<string, unknown> = {}
) => {
  // add user to config
  await addUserConfig(fs, dir, gitdir)

  // Use the provided cache (or create a new one) to ensure add() and stash() see the same index state
  // IMPORTANT: Tests should pass the same cache to stashChanges and subsequent stash operations

  const aContent = await fs.read(`${dir}/a.txt`)
  const bContent = await fs.read(`${dir}/b.js`)
  await fs.write(`${dir}/a.txt`, 'staged changes - a')
  await fs.write(`${dir}/b.js`, 'staged changes - b')

  await add({ fs, dir, gitdir, filepath: ['a.txt', 'b.js'], cache })
  let aStatus = await status({ fs, dir, gitdir, filepath: 'a.txt', cache })
  assert.strictEqual(aStatus, 'modified')

  let bStatus = await status({ fs, dir, gitdir, filepath: 'b.js', cache })
  assert.strictEqual(bStatus, 'modified')

  let mStatus = await status({ fs, dir, gitdir, filepath: 'm.xml', cache })
  if (defalt) {
    // include unstaged changes, different file first
    await fs.write(`${dir}/m.xml`, '<unstaged>m</unstaged>')
    mStatus = await status({ fs, dir, gitdir, filepath: 'm.xml', cache })
    assert.strictEqual(mStatus, '*modified')

    if (again) {
      // same file changes again after staged
      await fs.write(`${dir}/a.txt`, 'unstaged changes - a - again')
      aStatus = await status({ fs, dir, gitdir, filepath: 'a.txt', cache })
      assert.strictEqual(aStatus, '*modified')
    }
  }

  let error: unknown = null
  try {
    await stash({ fs, dir, gitdir, message, cache })
    const aContentAfterStash = await fs.read(`${dir}/a.txt`)
    assert.strictEqual(aContentAfterStash.toString(), aContent.toString())

    const bContentAfterStash = await fs.read(`${dir}/b.js`)
    assert.strictEqual(bContentAfterStash.toString(), bContent.toString())
  } catch (e) {
    error = e
  }

  assert.strictEqual(error, null)
  aStatus = await status({ fs, dir, gitdir, filepath: 'a.txt', cache })
  assert.strictEqual(aStatus, 'unmodified')
  bStatus = await status({ fs, dir, gitdir, filepath: 'b.js', cache })
  assert.strictEqual(bStatus, 'unmodified')
  mStatus = await status({ fs, dir, gitdir, filepath: 'm.xml', cache })
  assert.strictEqual(mStatus, 'unmodified')
}

describe('stash', () => {
  // CRITICAL: Clear the static Repository instance cache before each test
  // This ensures test isolation - each test gets a fresh Repository instance
  beforeEach(async () => {
    const { Repository } = await import('../../src/core-utils/Repository.ts')
    Repository.clearInstanceCache()
  })

  describe('abort stash', () => {
    it('stash without user', async () => {
      const { fs, dir, gitdir } = await makeFixture('test-stash')

      let error: unknown = null
      try {
        await stash({ fs, dir, gitdir, autoDetectConfig: false })
      } catch (e) {
        error = e
      }

      assert.notStrictEqual(error, null)
      assert.strictEqual((error as any).caller, 'git.stash')
      assert.strictEqual((error as any).code, Errors.MissingNameError.code)
      assert.strictEqual((error as any).data.role, 'author')
    })

    it('stash with no changes', async () => {
      const { fs, dir, gitdir } = await makeFixture('test-stash')

      // CRITICAL: Use a shared cache object for ALL git commands
      // This ensures state modifications (like index updates) are immediately
      // visible to subsequent commands, eliminating race conditions
      const cache: Record<string, unknown> = {}

      // add user to config
      await addUserConfig(fs, dir, gitdir)

      // CRITICAL: Reset to HEAD to ensure a clean state (index and workdir match HEAD)
      // Pass the same cache to ensure checkout sees the latest state
      await resetToCommit(fs, dir, gitdir, 'HEAD', cache)

      let error: unknown = null
      try {
        // Use the same cache so stash sees the state that checkout just set
        await stash({ fs, dir, gitdir, cache })
      } catch (e) {
        error = e
      }

      assert.notStrictEqual(error, null)
      assert.strictEqual((error as any).caller, 'git.stash')
      assert.strictEqual((error as any).code, Errors.NotFoundError.code)
      assert.strictEqual((error as any).data.what, 'changes, nothing to stash')
    })
  })

  describe('stash push', () => {
    it('stash with staged changes', async () => {
      const { fs, dir, gitdir } = await makeFixture('test-stash')
      await stashChanges(fs, dir, gitdir, false, false) // no unstaged changes
    })

    it('stash with staged and unstaged changes', async () => {
      const { fs, dir, gitdir } = await makeFixture('test-stash')
      await stashChanges(fs, dir, gitdir, true, false) // with unstaged changes
    })

    it('stash with staged and unstaged changes plus same file changes', async () => {
      const { fs, dir, gitdir } = await makeFixture('test-stash')
      await stashChanges(fs, dir, gitdir, true, true) // with unstaged changes
    })
  })

  describe('stash create', () => {
    it('stash create without user', async () => {
      const { fs, dir, gitdir } = await makeFixture('test-stash')

      let error: unknown = null
      try {
        await stash({ fs, dir, gitdir, op: 'create', autoDetectConfig: false })
      } catch (e) {
        error = e
      }

      assert.notStrictEqual(error, null)
      assert.strictEqual((error as any).caller, 'git.stash')
      assert.strictEqual((error as any).code, Errors.MissingNameError.code)
      assert.strictEqual((error as any).data.role, 'author')
    })

    it('stash create with staged changes - returns commit hash without modifying working dir', async () => {
      const { fs, dir, gitdir } = await makeFixture('test-stash')
      await addUserConfig(fs, dir, gitdir)

      const aOriginalContent = 'staged changes - a'
      const bOriginalContent = 'staged changes - b'

      await fs.write(`${dir}/a.txt`, aOriginalContent)
      await fs.write(`${dir}/b.js`, bOriginalContent)
      await add({ fs, dir, gitdir, filepath: ['a.txt', 'b.js'] })

      const aStatusBefore = await status({ fs, dir, gitdir, filepath: 'a.txt' })
      assert.strictEqual(aStatusBefore, 'modified')
      const bStatusBefore = await status({ fs, dir, gitdir, filepath: 'b.js' })
      assert.strictEqual(bStatusBefore, 'modified')

      let stashCommitHash: string | null = null
      let error: unknown = null
      try {
        stashCommitHash = await stash({ fs, dir, gitdir, op: 'create' })
      } catch (e) {
        error = e
      }

      assert.strictEqual(error, null)
      assert.notStrictEqual(stashCommitHash, null)
      assert.strictEqual(typeof stashCommitHash, 'string')
      assert.strictEqual(stashCommitHash!.length, 40) // SHA-1 hash length

      // Verify working directory is NOT modified
      const aContent = await fs.read(`${dir}/a.txt`)
      assert.strictEqual(aContent.toString(), aOriginalContent)
      const bContent = await fs.read(`${dir}/b.js`)
      assert.strictEqual(bContent.toString(), bOriginalContent)

      // Verify status is still modified
      const aStatusAfter = await status({ fs, dir, gitdir, filepath: 'a.txt' })
      assert.strictEqual(aStatusAfter, 'modified')
      const bStatusAfter = await status({ fs, dir, gitdir, filepath: 'b.js' })
      assert.strictEqual(bStatusAfter, 'modified')

      // Verify stash ref is NOT created
      const stashList = await stash({ fs, dir, gitdir, op: 'list' })
      assert.strictEqual(stashList.length, 0)
    })
  })

  describe('stash apply', () => {
    it('stash apply with staged changes', async () => {
      const { fs, dir, gitdir } = await makeFixture('test-stash')

      // CRITICAL: Use a shared cache for all operations
      const cache: Record<string, unknown> = {}
      await stashChanges(fs, dir, gitdir, false, false, '', cache) // no unstaged changes

      let error: unknown = null
      try {
        await stash({ fs, dir, gitdir, op: 'apply', cache })
      } catch (e) {
        error = e
      }

      const aContent = await fs.read(`${dir}/a.txt`)
      assert.strictEqual(aContent.toString(), 'staged changes - a') // make sure the staged changes are applied
      const bContent = await fs.read(`${dir}/b.js`)
      assert.strictEqual(bContent.toString(), 'staged changes - b') // make sure the staged changes are applied

      assert.strictEqual(error, null)
      const aStatus = await status({ fs, dir, gitdir, filepath: 'a.txt', cache })
      assert.strictEqual(aStatus, 'modified')
      const bStatus = await status({ fs, dir, gitdir, filepath: 'b.js', cache })
      assert.strictEqual(bStatus, 'modified')
    })
  })

  describe('stash list', () => {
    it('stash list with no stash', async () => {
      // Create on-demand fixture to avoid stale stash reflog data
      const { createTestRepo, createInitialCommit } = await import('../helpers/nativeGit.ts')
      const repo = await createTestRepo('sha1')
      try {
        // Create initial commit matching test-stash fixture structure
        await createInitialCommit(repo, {
          'a.txt': 'text',
          'b.js': 'text',
        }, 'docs: add initial TODO.md file with to-do list')
        
        await addUserConfig(repo.fs, repo.path, repo.gitdir)
        
        const stashList = await stash({ fs: repo.fs, dir: repo.path, gitdir: repo.gitdir, op: 'list' })
        assert.deepStrictEqual(stashList, [])
      } finally {
        await repo.cleanup()
      }
    })

    it('stash list with 1 stash', async () => {
      // Create on-demand fixture to avoid stale stash reflog data
      const { createTestRepo, createInitialCommit } = await import('../helpers/nativeGit.ts')
      const repo = await createTestRepo('sha1')
      try {
        // Create initial commit matching test-stash fixture structure
        await createInitialCommit(repo, {
          'a.txt': 'text',
          'b.js': 'text',
          'm.xml': '<root/>',
        }, 'docs: add initial TODO.md file with to-do list')
        
        await stashChanges(repo.fs, repo.path, repo.gitdir, true, false) // staged and non-unstaged 3 file changes

        const stashList = await stash({ fs: repo.fs, dir: repo.path, gitdir: repo.gitdir, op: 'list' })
        assert.strictEqual(stashList.length, 1)
      } finally {
        await repo.cleanup()
      }
    })

    it('stash list with 2 stashes', async () => {
      // Create on-demand fixture to avoid stale stash reflog data
      const { createTestRepo, createInitialCommit } = await import('../helpers/nativeGit.ts')
      const repo = await createTestRepo('sha1')
      try {
        // Create initial commit matching test-stash fixture structure
        await createInitialCommit(repo, {
          'a.txt': 'text',
          'b.js': 'text',
          'm.xml': '<root/>',
        }, 'docs: add initial TODO.md file with to-do list')
        
        await stashChanges(repo.fs, repo.path, repo.gitdir, true, false) // staged and non-unstaged changes
        await stashChanges(repo.fs, repo.path, repo.gitdir, true, false) // staged and non-unstaged changes

        const stashList = await stash({ fs: repo.fs, dir: repo.path, gitdir: repo.gitdir, op: 'list' })
        assert.strictEqual(stashList.length, 2)
      } finally {
        await repo.cleanup()
      }
    })
  })

  describe('stash drop', () => {
    it('stash drop with no stash', async () => {
      const { fs, dir, gitdir } = await makeFixture('test-stash')

      let error: unknown = null
      try {
        await stash({ fs, dir, gitdir, op: 'drop' })
      } catch (e) {
        error = e
      }

      assert.strictEqual(error, null)
    })

    it('stash drop with stash', async () => {
      const { fs, dir, gitdir } = await makeFixture('test-stash')

      await stashChanges(fs, dir, gitdir, true, false) // staged and non-unstaged changes

      let error: unknown = null
      try {
        await stash({ fs, dir, gitdir, op: 'drop' })
      } catch (e) {
        error = e
      }

      assert.strictEqual(error, null)
      const stashList = await stash({ fs, dir, gitdir, op: 'list' })
      assert.strictEqual(stashList.length, 0)
    })
  })

  describe('stash pop', () => {
    it('stash pop with no stash', async () => {
      const { fs, dir, gitdir } = await makeFixture('test-stash')

      let error: unknown = null
      try {
        await stash({ fs, dir, gitdir, op: 'pop' })
      } catch (e) {
        error = e
      }

      assert.strictEqual(error, null)
    })

    it('stash pop with 1 stash', async () => {
      const { fs, dir, gitdir } = await makeFixture('test-stash')

      // CRITICAL: Use a shared cache for all operations
      const cache: Record<string, unknown> = {}
      await stashChanges(fs, dir, gitdir, true, false, '', cache) // staged and non-unstaged changes

      let error: unknown = null
      try {
        await stash({ fs, dir, gitdir, op: 'pop', cache })
      } catch (e) {
        error = e
      }

      assert.strictEqual(error, null)
      const stashList = await stash({ fs, dir, gitdir, op: 'list', cache })
      assert.strictEqual(stashList.length, 0)
    })
  })
})

