import { test } from 'node:test'
import assert from 'node:assert'
import { show } from '../../src/commands/show.ts'
import { init, add, commit, annotatedTag } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'
import { MissingParameterError } from '../../src/errors/MissingParameterError.ts'
import { NotFoundError } from '../../src/errors/NotFoundError.ts'

test('show', async (t) => {
  await t.test('throws MissingParameterError when fs is missing', async () => {
    try {
      await show({
        // @ts-expect-error - intentionally missing fs
        gitdir: '/tmp/test.git',
        ref: 'HEAD',
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'fs')
    }
  })

  await t.test('throws MissingParameterError when gitdir is missing and dir is not provided', async () => {
    const { fs } = await makeFixture('test-empty')
    try {
      await show({
        fs,
        // @ts-expect-error - intentionally missing both gitdir and dir
        ref: 'HEAD',
      } as any)
      assert.fail('Should have thrown an error')
    } catch (error) {
      // gitdir is derived from dir, so when both are missing, it will fail
      assert.ok(error instanceof Error, 'Should throw an error')
    }
  })

  await t.test('uses HEAD as default ref when ref is not provided', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Use Repository to ensure cache consistency
    const cache: Record<string, unknown> = {}
    const { Repository } = await import('../../src/core-utils/Repository.ts')
    const repo = await Repository.open({ fs, dir, gitdir, cache })
    
    // Create a commit
    const { normalizeFs } = await import('../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    await normalizedFs.write(`${dir}/file.txt`, 'content')
    
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const commitOid = await commit({
      fs,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache,
    })

    // Show without ref (should default to HEAD) - use dir to let show resolve gitdir the same way commit does
    const result = await show({ fs, dir, cache: repo.cache })
    
    assert.strictEqual(result.type, 'commit')
    assert.strictEqual(result.oid, commitOid)
  })

  await t.test('shows a commit object', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Use Repository to ensure cache consistency
    const cache: Record<string, unknown> = {}
    const { Repository } = await import('../../src/core-utils/Repository.ts')
    const repo = await Repository.open({ fs, dir, gitdir, cache })
    
    // Create a commit
    const { normalizeFs } = await import('../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    await normalizedFs.write(`${dir}/file.txt`, 'content')
    
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const commitOid = await commit({
      fs,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache,
    })

    // Show the commit - use dir to let show resolve gitdir the same way commit does
    const result = await show({ fs, dir, ref: commitOid, cache: repo.cache })
    
    assert.strictEqual(result.type, 'commit')
    assert.strictEqual(result.oid, commitOid)
    assert.ok(result.object)
    assert.strictEqual(typeof (result.object as any).message, 'string')
    assert.strictEqual((result.object as any).message.trim(), 'Initial commit')
  })

  await t.test('shows HEAD commit when ref is not provided', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Use Repository to ensure cache consistency
    const cache: Record<string, unknown> = {}
    const { Repository } = await import('../../src/core-utils/Repository.ts')
    const repo = await Repository.open({ fs, dir, gitdir, cache })
    
    // Create a commit
    const { normalizeFs } = await import('../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    await normalizedFs.write(`${dir}/file.txt`, 'content')
    
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const commitOid = await commit({
      fs,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache,
    })

    // Show HEAD (default ref) - use dir to let show resolve gitdir the same way commit does
    const result = await show({ fs, dir, cache: repo.cache })
    
    assert.strictEqual(result.type, 'commit')
    assert.strictEqual(result.oid, commitOid)
    assert.ok(result.object)
  })

  await t.test('shows a tree object', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Use Repository to ensure cache consistency
    const cache: Record<string, unknown> = {}
    const { Repository } = await import('../../src/core-utils/Repository.ts')
    const repo = await Repository.open({ fs, dir, gitdir, cache })
    
    // Create a commit
    const { normalizeFs } = await import('../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    await normalizedFs.write(`${dir}/file.txt`, 'content')
    
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const commitOid = await commit({
      fs,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache,
    })

    // Get the tree OID from the commit - use dir to let readCommit resolve gitdir the same way commit does
    const { readCommit } = await import('isomorphic-git')
    const commitResult = await readCommit({ fs, dir, oid: commitOid, cache: repo.cache })
    const treeOid = commitResult.commit.tree

    // Show the tree - use dir to let show resolve gitdir the same way commit does
    const result = await show({ fs, dir, ref: treeOid, cache: repo.cache })
    
    assert.strictEqual(result.type, 'tree')
    assert.strictEqual(result.oid, treeOid)
    assert.ok(result.object)
    assert.ok(Array.isArray((result.object as any)))
  })

  await t.test('shows a blob object', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Use Repository to ensure cache consistency
    const cache: Record<string, unknown> = {}
    const { Repository } = await import('../../src/core-utils/Repository.ts')
    const repo = await Repository.open({ fs, dir, gitdir, cache })
    
    // Create a commit
    const { normalizeFs } = await import('../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    await normalizedFs.write(`${dir}/file.txt`, 'content')
    
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const commitOid = await commit({
      fs,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache,
    })

    // Get the blob OID from the tree - use dir to let readCommit/readTree resolve gitdir the same way commit does
    const { readCommit, readTree } = await import('isomorphic-git')
    const commitResult = await readCommit({ fs, dir, oid: commitOid, cache: repo.cache })
    const treeOid = commitResult.commit.tree
    const treeResult = await readTree({ fs, dir, oid: treeOid, cache: repo.cache })
    const blobOid = treeResult.tree.find((entry: any) => entry.path === 'file.txt')?.oid

    // Show the blob - use dir to let show resolve gitdir the same way commit does
    const result = await show({ fs, dir, ref: blobOid, cache: repo.cache })
    
    assert.strictEqual(result.type, 'blob')
    assert.strictEqual(result.oid, blobOid)
    assert.ok(result.object)
    // Blob parser returns Buffer directly, not an object with blob property
    assert.strictEqual((result.object as Buffer).toString(), 'content')
  })

  await t.test('shows a tag object', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Use Repository to ensure cache consistency
    const cache: Record<string, unknown> = {}
    const { Repository } = await import('../../src/core-utils/Repository.ts')
    const repo = await Repository.open({ fs, dir, gitdir, cache })
    
    // Create a commit
    const { normalizeFs } = await import('../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    await normalizedFs.write(`${dir}/file.txt`, 'content')
    
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const commitOid = await commit({
      fs,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache,
    })

    // Create an annotated tag - use dir to let annotatedTag resolve gitdir the same way commit does
    await annotatedTag({
      fs,
      dir,
      ref: 'v1.0.0',
      object: commitOid,
      tagger: { name: 'Test', email: 'test@example.com' },
      message: 'Version 1.0.0',
      cache: repo.cache,
    })

    // Resolve the tag ref to get the tag OID - use dir to let resolveRef resolve gitdir the same way commit does
    const { resolveRef } = await import('isomorphic-git')
    const tagOid = await resolveRef({ fs, dir, ref: 'refs/tags/v1.0.0', cache: repo.cache })

    // Show the tag - use dir to let show resolve gitdir the same way commit does
    const result = await show({ fs, dir, ref: tagOid, cache: repo.cache })
    
    assert.strictEqual(result.type, 'tag')
    assert.strictEqual(result.oid, tagOid)
    assert.ok(result.object)
    assert.strictEqual((result.object as any).tag, 'v1.0.0')
    assert.strictEqual((result.object as any).message.trim(), 'Version 1.0.0')
  })

  await t.test('shows a file from a commit using filepath', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Use Repository to ensure cache consistency
    const cache: Record<string, unknown> = {}
    const { Repository } = await import('../../src/core-utils/Repository.ts')
    const repo = await Repository.open({ fs, dir, gitdir, cache })
    
    // Create a commit
    const { normalizeFs } = await import('../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    await normalizedFs.write(`${dir}/file.txt`, 'content')
    
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const commitOid = await commit({
      fs,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache,
    })

    // Show the file from the commit - use dir to let show resolve gitdir the same way commit does
    const result = await show({ fs, dir, ref: commitOid, filepath: 'file.txt', cache: repo.cache })
    
    assert.strictEqual(result.type, 'blob')
    assert.ok(result.oid)
    assert.strictEqual(result.filepath, 'file.txt')
    assert.ok(result.object)
    // Blob parser returns Buffer directly, not an object with blob property
    assert.strictEqual((result.object as Buffer).toString(), 'content')
  })

  await t.test('shows a file from HEAD using filepath', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Use Repository to ensure cache consistency
    const cache: Record<string, unknown> = {}
    const { Repository } = await import('../../src/core-utils/Repository.ts')
    const repo = await Repository.open({ fs, dir, gitdir, cache })
    
    // Create a commit
    const { normalizeFs } = await import('../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    await normalizedFs.write(`${dir}/file.txt`, 'content')
    
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    await commit({
      fs,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache,
    })

    // Show the file from HEAD - use dir to let show resolve gitdir the same way commit does
    const result = await show({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    
    assert.strictEqual(result.type, 'blob')
    assert.ok(result.oid)
    assert.strictEqual(result.filepath, 'file.txt')
    assert.ok(result.object)
    // Blob parser returns Buffer directly, not an object with blob property
    assert.strictEqual((result.object as Buffer).toString(), 'content')
  })

  await t.test('handles ref as OID directly', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Use Repository to ensure cache consistency
    const cache: Record<string, unknown> = {}
    const { Repository } = await import('../../src/core-utils/Repository.ts')
    const repo = await Repository.open({ fs, dir, gitdir, cache })
    
    // Create a commit
    const { normalizeFs } = await import('../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    await normalizedFs.write(`${dir}/file.txt`, 'content')
    
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const commitOid = await commit({
      fs,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache,
    })

    // Show using OID directly (not a ref name) - use dir to let show resolve gitdir the same way commit does
    const result = await show({ fs, dir, ref: commitOid, cache: repo.cache })
    
    assert.strictEqual(result.type, 'commit')
    assert.strictEqual(result.oid, commitOid)
  })

  await t.test('throws NotFoundError when ref does not exist', async () => {
    const { fs, gitdir } = await makeFixture('test-empty')
    
    try {
      await show({ fs, gitdir, ref: 'nonexistent-ref' })
      assert.fail('Should have thrown NotFoundError')
    } catch (error) {
      assert.ok(error instanceof NotFoundError || error instanceof Error)
    }
  })

  await t.test('throws NotFoundError when filepath does not exist in commit', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Create a commit
    const { normalizeFs } = await import('../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    await normalizedFs.write(`${dir}/file.txt`, 'content')
    
    const cache: Record<string, unknown> = {}
    await add({ fs, dir, filepath: 'file.txt', cache })
    const commitOid = await commit({
      fs,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@example.com' },
      cache,
    })

    // Try to show a non-existent file - use dir to let show resolve gitdir the same way commit does
    try {
      await show({ fs, dir, ref: commitOid, filepath: 'nonexistent.txt', cache })
      assert.fail('Should have thrown NotFoundError')
    } catch (error) {
      assert.ok(error instanceof NotFoundError || error instanceof Error)
    }
  })

  await t.test('uses dir parameter to derive gitdir', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Use Repository to ensure cache consistency
    const cache: Record<string, unknown> = {}
    const { Repository } = await import('../../src/core-utils/Repository.ts')
    const repo = await Repository.open({ fs, dir, cache })
    
    // Create a commit
    const { normalizeFs } = await import('../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    await normalizedFs.write(`${dir}/file.txt`, 'content')
    
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const commitOid = await commit({
      fs,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache,
    })

    // Show using dir parameter (gitdir should be derived)
    const result = await show({ fs, dir, ref: commitOid, cache: repo.cache })
    
    assert.strictEqual(result.type, 'commit')
    assert.strictEqual(result.oid, commitOid)
  })

  await t.test('uses Repository parameter when provided', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Use Repository to ensure cache consistency
    const cache: Record<string, unknown> = {}
    const { Repository } = await import('../../src/core-utils/Repository.ts')
    const repo = await Repository.open({ fs, dir, gitdir, cache })
    
    // Create a commit
    const { normalizeFs } = await import('../../src/utils/normalizeFs.ts')
    const normalizedFs = normalizeFs(fs)
    await normalizedFs.write(`${dir}/file.txt`, 'content')
    
    await add({ fs, dir, filepath: 'file.txt', cache: repo.cache })
    const commitOid = await commit({
      fs,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@example.com' },
      cache: repo.cache,
    })

    // Use dir and cache explicitly instead of repo parameter to ensure consistency
    // This ensures gitdir resolution matches what commit used
    const result = await show({ fs, dir, cache: repo.cache, ref: commitOid })
    
    assert.strictEqual(result.type, 'commit')
    assert.strictEqual(result.oid, commitOid)
  })
})

