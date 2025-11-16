import { test } from 'node:test'
import assert from 'node:assert'
import { expandRef, init, writeRef } from 'isomorphic-git'
import { readRef } from '../../src/git/refs/readRef.ts'
import { makeFixture } from '../helpers/fixture.ts'
import { MissingParameterError } from '../../src/errors/MissingParameterError.ts'
import { NotFoundError } from '../../src/errors/NotFoundError.ts'

test('expandRef', async (t) => {
  await t.test('throws MissingParameterError when fs is missing', async () => {
    try {
      await expandRef({
        // @ts-expect-error - intentionally missing fs
        gitdir: '/tmp/test.git',
        ref: 'main',
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'fs')
    }
  })

  await t.test('throws MissingParameterError when gitdir is missing', async () => {
    const { fs } = await makeFixture('test-empty')
    try {
      await expandRef({
        fs,
        // @ts-expect-error - intentionally missing gitdir
        ref: 'main',
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'gitdir')
    }
  })

  await t.test('throws MissingParameterError when ref is missing', async () => {
    const { fs, gitdir } = await makeFixture('test-empty')
    try {
      await expandRef({
        fs,
        gitdir,
        // @ts-expect-error - intentionally missing ref
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'ref')
    }
  })

  await t.test('returns full SHA when given a complete 40-character SHA', async () => {
    const { fs, gitdir } = await makeFixture('test-empty')
    const sha = 'a'.repeat(40)
    const result = await expandRef({ fs, gitdir, ref: sha })
    assert.strictEqual(result, sha)
  })

  await t.test('returns full SHA when given a valid SHA with numbers and letters', async () => {
    const { fs, gitdir } = await makeFixture('test-empty')
    const sha = '0123456789abcdef0123456789abcdef01234567'
    const result = await expandRef({ fs, gitdir, ref: sha })
    assert.strictEqual(result, sha)
  })

  await t.test('expands branch name to refs/heads/', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    await writeRef({ fs, gitdir, ref: 'refs/heads/main', value: 'a'.repeat(40) })
    const result = await expandRef({ fs, gitdir, ref: 'main' })
    assert.strictEqual(result, 'refs/heads/main')
  })

  await t.test('expands tag name to refs/tags/', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    await writeRef({ fs, gitdir, ref: 'refs/tags/v1.0.0', value: 'a'.repeat(40) })
    const result = await expandRef({ fs, gitdir, ref: 'v1.0.0' })
    assert.strictEqual(result, 'refs/tags/v1.0.0')
  })

  await t.test('expands refs/heads/ directly', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    await writeRef({ fs, gitdir, ref: 'refs/heads/main', value: 'a'.repeat(40) })
    const result = await expandRef({ fs, gitdir, ref: 'refs/heads/main' })
    assert.strictEqual(result, 'refs/heads/main')
  })

  await t.test('expands refs/tags/ directly', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    await writeRef({ fs, gitdir, ref: 'refs/tags/v1.0.0', value: 'a'.repeat(40) })
    const result = await expandRef({ fs, gitdir, ref: 'refs/tags/v1.0.0' })
    assert.strictEqual(result, 'refs/tags/v1.0.0')
  })

  await t.test('expands refs/remotes/ directly', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    await writeRef({ fs, gitdir, ref: 'refs/remotes/origin/main', value: 'a'.repeat(40) })
    const result = await expandRef({ fs, gitdir, ref: 'refs/remotes/origin/main' })
    assert.strictEqual(result, 'refs/remotes/origin/main')
  })

  await t.test('expands remote branch name to refs/remotes/', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    await writeRef({ fs, gitdir, ref: 'refs/remotes/origin/main', value: 'a'.repeat(40) })
    const result = await expandRef({ fs, gitdir, ref: 'origin/main' })
    assert.strictEqual(result, 'refs/remotes/origin/main')
  })

  await t.test('expands refs/remotes/HEAD', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    await writeRef({ fs, gitdir, ref: 'refs/remotes/origin/HEAD', value: 'a'.repeat(40) })
    const result = await expandRef({ fs, gitdir, ref: 'origin/HEAD' })
    assert.strictEqual(result, 'refs/remotes/origin/HEAD')
  })

  await t.test('throws NotFoundError when ref does not exist', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    try {
      await expandRef({ fs, gitdir, ref: 'nonexistent' })
      assert.fail('Should have thrown NotFoundError')
    } catch (error) {
      assert.ok(error instanceof NotFoundError)
      assert.strictEqual((error as any).message, 'Could not find nonexistent.')
    }
  })

  await t.test('expands ref from packed-refs', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    // Create a packed ref
    const packedRefsPath = `${gitdir}/packed-refs`
    const packedRefsContent = `# pack-refs with: peeled fully-peeled sorted
${'a'.repeat(40)} refs/heads/packed-branch
`
    await fs.write(packedRefsPath, packedRefsContent, 'utf8')
    const result = await expandRef({ fs, gitdir, ref: 'packed-branch' })
    assert.strictEqual(result, 'refs/heads/packed-branch')
  })

  await t.test('prefers loose refs over packed refs', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    // Create a loose ref
    await writeRef({ fs, gitdir, ref: 'refs/heads/test-branch', value: 'b'.repeat(40) })
    // Create a packed ref with same name but different value
    const packedRefsPath = `${gitdir}/packed-refs`
    const packedRefsContent = `# pack-refs with: peeled fully-peeled sorted
${'a'.repeat(40)} refs/heads/test-branch
`
    await fs.write(packedRefsPath, packedRefsContent, 'utf8')
    const result = await expandRef({ fs, gitdir, ref: 'test-branch' })
    assert.strictEqual(result, 'refs/heads/test-branch')
    // Verify it's the loose ref (not the packed one)
    const value = await readRef({ fs, gitdir, ref: 'refs/heads/test-branch' })
    assert.strictEqual(value, 'b'.repeat(40))
  })
})

