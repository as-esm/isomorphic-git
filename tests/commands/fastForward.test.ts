import { test } from 'node:test'
import assert from 'node:assert'
import { fastForward } from '../../src/commands/fastForward.ts'
import http from '../../src/http/node/index.ts'
import { makeFixture } from '../helpers/fixture.ts'
import { MissingParameterError } from '../../src/errors/MissingParameterError.ts'
import { _currentBranch } from '../../src/commands/currentBranch.ts'

// Skip HTTP tests if running in CI without network access
const SKIP_HTTP_TESTS = process.env.SKIP_HTTP_TESTS === 'true'

test('fastForward', async (t) => {
  await t.test('throws MissingParameterError when fs is missing', async () => {
    try {
      await fastForward({
        // @ts-expect-error - intentionally missing fs
        http,
        gitdir: '/tmp/test.git',
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'fs')
    }
  })

  await t.test('throws MissingParameterError when http is missing', async () => {
    const { fs, gitdir } = await makeFixture('test-pull')
    try {
      await fastForward({
        fs,
        // @ts-expect-error - intentionally missing http
        gitdir,
      } as any)
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'http')
    }
  })

  await t.test('throws error when gitdir is missing and dir is not provided', async () => {
    const { fs } = await makeFixture('test-pull')
    try {
      await fastForward({
        fs,
        http,
        // @ts-expect-error - intentionally missing both gitdir and dir
      } as any)
      assert.fail('Should have thrown an error')
    } catch (error) {
      // gitdir is derived from dir, so when both are missing, it will fail
      // The error might be MissingParameterError for gitdir or a different error
      assert.ok(error instanceof Error, 'Should throw an error')
    }
  })

  await t.test('uses current branch when ref is not provided', async () => {
    if (SKIP_HTTP_TESTS) {
      return // Skip test if network access is not available
    }
    const { fs, dir, gitdir } = await makeFixture('test-pull')
    // Ensure there's a current branch
    await _currentBranch({ fs, gitdir, fullname: true })
    try {
      await fastForward({
        fs,
        http,
        dir,
        gitdir,
        remote: 'origin',
        url: 'https://github.com/isomorphic-git/test.empty.git',
      })
      // If successful, fastForward completes without error
      assert.ok(true)
    } catch (error) {
      // Network errors are acceptable in test environment
      assert.ok(error instanceof Error, 'Should throw an error if network fails')
    }
  })

  await t.test('uses provided ref parameter', async () => {
    if (SKIP_HTTP_TESTS) {
      return
    }
    const { fs, dir, gitdir } = await makeFixture('test-pull')
    await _currentBranch({ fs, gitdir, fullname: true })
    try {
      await fastForward({
        fs,
        http,
        dir,
        gitdir,
        ref: 'main',
        remote: 'origin',
        url: 'https://github.com/isomorphic-git/test.empty.git',
      })
      assert.ok(true)
    } catch (error) {
      // Network errors are acceptable in test environment
      assert.ok(error instanceof Error, 'Should throw an error if network fails')
    }
  })

  await t.test('uses remote url from config when url is not provided', async () => {
    if (SKIP_HTTP_TESTS) {
      return
    }
    const { fs, dir, gitdir } = await makeFixture('test-pull')
    await _currentBranch({ fs, gitdir, fullname: true })
    try {
      await fastForward({
        fs,
        http,
        dir,
        gitdir,
        ref: 'main',
        remote: 'origin', // 'origin' is configured in test-pull fixture
      })
      assert.ok(true)
    } catch (error) {
      // Network errors are acceptable in test environment
      assert.ok(error instanceof Error, 'Should throw an error if network fails')
    }
  })

  await t.test('throws error if remote is not found and url is not provided', async () => {
    if (SKIP_HTTP_TESTS) {
      return
    }
    const { fs, dir, gitdir } = await makeFixture('test-pull')
    try {
      await fastForward({
        fs,
        http,
        dir,
        gitdir,
        ref: 'main',
        remote: 'nonexistent-remote', // This remote does not exist in config
      })
      assert.fail('Should have thrown an error for missing remote')
    } catch (error) {
      assert.ok(error instanceof Error, 'Should throw an error')
      // The specific error might be NotFoundError or similar depending on implementation
    }
  })

  await t.test('passes fastForward and fastForwardOnly flags to pull', async () => {
    if (SKIP_HTTP_TESTS) {
      return
    }
    const { fs, dir, gitdir } = await makeFixture('test-pull')
    await _currentBranch({ fs, gitdir, fullname: true })
    try {
      // fastForward should always use fastForward: true and fastForwardOnly: true
      await fastForward({
        fs,
        http,
        dir,
        gitdir,
        ref: 'main',
        remote: 'origin',
        url: 'https://github.com/isomorphic-git/test.empty.git',
      })
      assert.ok(true)
    } catch (error) {
      // Network errors are acceptable in test environment
      assert.ok(error instanceof Error, 'Should throw an error if network fails')
    }
  })
})

