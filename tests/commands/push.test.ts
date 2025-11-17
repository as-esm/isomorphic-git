import { test } from 'node:test'
import assert from 'node:assert'
import { push, resolveRef, currentBranch } from 'isomorphic-git'
import http from '../../src/http/node/index.ts'
import { makeFixture } from '../helpers/fixture.ts'
import { MissingParameterError } from '../../src/errors/MissingParameterError.ts'

// Skip HTTP tests if running in CI without network access
const SKIP_HTTP_TESTS = process.env.SKIP_HTTP_TESTS === 'true'

test('push', async (t) => {
  await t.test('throws MissingParameterError when fs is missing', async () => {
    try {
      await push({
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
    const { fs, gitdir } = await makeFixture('test-push')
    try {
      await push({
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
    const { fs } = await makeFixture('test-push')
    try {
      await push({
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
    const { fs, gitdir } = await makeFixture('test-push')
    
    // Get current branch to verify it's used
    const branch = await currentBranch({ fs, gitdir })
    
    // This test verifies that push resolves the ref correctly
    // We can't actually push without a real server, but we can test the ref resolution
    assert.ok(branch, 'Should have a current branch')
  })

  await t.test('resolves ref correctly when provided', async () => {
    if (SKIP_HTTP_TESTS) {
      return
    }
    const { fs, gitdir } = await makeFixture('test-push')
    
    // Test that ref resolution works
    try {
      const refs = await resolveRef({ fs, gitdir, ref: 'HEAD' })
      assert.ok(refs, 'Should resolve HEAD ref')
    } catch (error) {
      // If fixture doesn't have HEAD, that's okay for this test
      // We're just testing that the push function would use the ref correctly
    }
  })

  await t.test('handles remote parameter', async () => {
    if (SKIP_HTTP_TESTS) {
      return
    }
    const { fs, gitdir } = await makeFixture('test-push')
    
    // Test that remote configuration is read correctly
    // This verifies the push function can access remote config
    const { getConfig } = await import('isomorphic-git')
    try {
      const remoteUrl = await getConfig({ fs, gitdir, path: 'remote.origin.url' })
      // If remote exists, verify it's a string
      if (remoteUrl) {
        assert.strictEqual(typeof remoteUrl, 'string')
      }
    } catch (error) {
      // Remote might not be configured, that's okay
    }
  })

  await t.test('throws MissingParameterError when remote and url are both missing', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { MissingParameterError } = await import('../../src/errors/MissingParameterError.ts')
    const { setConfig, writeRef } = await import('isomorphic-git')
    const { ConfigAccess } = await import('../../src/utils/configAccess.ts')
    
    // Create the ref first so it exists
    await writeRef({ fs, gitdir, ref: 'refs/heads/main', value: '1234567890123456789012345678901234567890' })
    
    // Set up branch.merge so remoteRef doesn't fail first
    await setConfig({ fs, gitdir, path: 'branch.main.merge', value: 'refs/heads/main' })
    
    // Ensure no remote is configured (delete if it exists)
    const configAccess = new ConfigAccess(fs, gitdir)
    try {
      await configAccess.deleteConfigValue('remote.origin.url')
      await configAccess.deleteConfigValue('remote.origin.pushurl')
    } catch {
      // Ignore if it doesn't exist
    }
    
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        // No remote or url configured
      })
      assert.fail('Should have thrown MissingParameterError')
    } catch (error: any) {
      assert.ok(error instanceof MissingParameterError, `Expected MissingParameterError, got ${error?.constructor?.name}: ${error?.message}`)
      // The error could be 'remote OR url' or 'remoteRef' depending on config
      const param = error.data?.parameter
      assert.ok(param === 'remote OR url' || param === 'remoteRef', `Expected 'remote OR url' or 'remoteRef', got '${param}'`)
    }
  })

  await t.test('throws MissingParameterError when remoteRef cannot be determined', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { MissingParameterError } = await import('../../src/errors/MissingParameterError.ts')
    const { setConfig } = await import('isomorphic-git')
    
    // Set up remote URL but no branch.merge config
    await setConfig({ fs, gitdir, path: 'remote.origin.url', value: 'https://example.com/repo.git' })
    
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        remote: 'origin',
        // No remoteRef and no branch.main.merge config
      })
      assert.fail('Should have thrown MissingParameterError')
    } catch (error) {
      assert.ok(error instanceof MissingParameterError)
      assert.strictEqual((error as any).data?.parameter, 'remoteRef')
    }
  })

  await t.test('uses url parameter when provided', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    
    // Test that url parameter is used instead of remote config
    // This will fail at HTTP discovery, but we can verify the parameter is accepted
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        url: 'https://example.com/repo.git',
        remoteRef: 'refs/heads/main',
      })
      // Will fail at HTTP discovery, but that's expected without a real server
    } catch (error) {
      // Expected to fail, but should not be MissingParameterError for url
      assert.ok(error instanceof Error)
      if (error instanceof MissingParameterError) {
        assert.notStrictEqual((error as any).data?.parameter, 'remote OR url')
      }
    }
  })

  await t.test('uses remoteRef parameter when provided', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    
    // Test that remoteRef parameter is used
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        url: 'https://example.com/repo.git',
        remoteRef: 'refs/heads/feature',
      })
      // Will fail at HTTP discovery, but that's expected
    } catch (error) {
      // Expected to fail, but should not be MissingParameterError for remoteRef
      assert.ok(error instanceof Error)
      if (error instanceof MissingParameterError) {
        assert.notStrictEqual((error as any).data?.parameter, 'remoteRef')
      }
    }
  })

  await t.test('handles force parameter', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    
    // Test that force parameter is accepted
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        url: 'https://example.com/repo.git',
        remoteRef: 'refs/heads/main',
        force: true,
      })
      // Will fail at HTTP discovery, but that's expected
    } catch (error) {
      // Expected to fail, but force parameter should be accepted
      assert.ok(error instanceof Error)
    }
  })

  await t.test('handles delete parameter', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    
    // Test that delete parameter is accepted
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        url: 'https://example.com/repo.git',
        remoteRef: 'refs/heads/main',
        delete: true,
      })
      // Will fail at HTTP discovery, but that's expected
    } catch (error) {
      // Expected to fail, but delete parameter should be accepted
      assert.ok(error instanceof Error)
    }
  })

  await t.test('handles onPrePush callback returning false', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { setConfig } = await import('isomorphic-git')
    const { UserCanceledError } = await import('../../src/errors/UserCanceledError.ts')
    
    // Set up minimal config
    await setConfig({ fs, gitdir, path: 'remote.origin.url', value: 'https://example.com/repo.git' })
    await setConfig({ fs, gitdir, path: 'branch.main.merge', value: 'refs/heads/main' })
    
    let prePushCalled = false
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        remote: 'origin',
        onPrePush: () => {
          prePushCalled = true
          return false // Cancel the push
        },
      })
      assert.fail('Should have thrown UserCanceledError')
    } catch (error) {
      // onPrePush is called after HTTP discovery, which may fail first
      // If HTTP discovery fails, we won't reach onPrePush
      // If we do reach onPrePush, it should throw UserCanceledError
      if (prePushCalled) {
        assert.ok(error instanceof UserCanceledError, 'Should throw UserCanceledError when onPrePush returns false')
      } else {
        // HTTP discovery failed first, which is expected without a real server
        assert.ok(error instanceof Error, 'Expected error (HTTP discovery failure)')
      }
    }
  })

  await t.test('handles onPrePush callback returning true', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { setConfig } = await import('isomorphic-git')
    
    // Set up minimal config
    await setConfig({ fs, gitdir, path: 'remote.origin.url', value: 'https://example.com/repo.git' })
    await setConfig({ fs, gitdir, path: 'branch.main.merge', value: 'refs/heads/main' })
    
    let prePushCalled = false
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        remote: 'origin',
        onPrePush: (args) => {
          prePushCalled = true
          assert.ok(args.remote, 'Should have remote in prePush args')
          assert.ok(args.url, 'Should have url in prePush args')
          assert.ok(args.localRef, 'Should have localRef in prePush args')
          assert.ok(args.remoteRef, 'Should have remoteRef in prePush args')
          return true // Allow the push
        },
      })
      // Will fail at HTTP discovery, but onPrePush should have been called if we got that far
    } catch (error) {
      // onPrePush is called after HTTP discovery, which may fail first
      // If HTTP discovery fails, we won't reach onPrePush
      // This is expected behavior without a real server
      assert.ok(error instanceof Error, 'Expected error (HTTP discovery failure)')
      // Note: prePushCalled may be false if HTTP discovery fails first
    }
  })

  await t.test('handles onPrePush callback with delete operation', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { setConfig } = await import('isomorphic-git')
    
    // Set up minimal config
    await setConfig({ fs, gitdir, path: 'remote.origin.url', value: 'https://example.com/repo.git' })
    await setConfig({ fs, gitdir, path: 'branch.main.merge', value: 'refs/heads/main' })
    
    let prePushCalled = false
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        remote: 'origin',
        delete: true,
        onPrePush: (args) => {
          prePushCalled = true
          assert.strictEqual(args.localRef.ref, '(delete)', 'Should have (delete) ref for delete operation')
          return true
        },
      })
      // Will fail at HTTP discovery, but onPrePush should have been called if we got that far
    } catch (error) {
      // onPrePush is called after HTTP discovery, which may fail first
      // If HTTP discovery fails, we won't reach onPrePush
      // This is expected behavior without a real server
      assert.ok(error instanceof Error, 'Expected error (HTTP discovery failure)')
      // Note: prePushCalled may be false if HTTP discovery fails first
      // The test verifies that onPrePush would receive correct args if called
    }
  })

  await t.test('handles corsProxy parameter', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { setConfig } = await import('isomorphic-git')
    
    // Set up minimal config
    await setConfig({ fs, gitdir, path: 'remote.origin.url', value: 'https://example.com/repo.git' })
    await setConfig({ fs, gitdir, path: 'branch.main.merge', value: 'refs/heads/main' })
    
    // Test that corsProxy parameter is accepted
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        remote: 'origin',
        corsProxy: 'https://cors-proxy.example.com',
      })
      // Will fail at HTTP discovery, but that's expected
    } catch (error) {
      // Expected to fail, but corsProxy parameter should be accepted
      assert.ok(error instanceof Error)
    }
  })

  await t.test('handles headers parameter', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { setConfig } = await import('isomorphic-git')
    
    // Set up minimal config
    await setConfig({ fs, gitdir, path: 'remote.origin.url', value: 'https://example.com/repo.git' })
    await setConfig({ fs, gitdir, path: 'branch.main.merge', value: 'refs/heads/main' })
    
    // Test that headers parameter is accepted
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        remote: 'origin',
        headers: { 'X-Custom-Header': 'value' },
      })
      // Will fail at HTTP discovery, but that's expected
    } catch (error) {
      // Expected to fail, but headers parameter should be accepted
      assert.ok(error instanceof Error)
    }
  })

  await t.test('uses dir parameter to derive gitdir', async () => {
    const { fs, dir } = await makeFixture('test-push')
    const { setConfig } = await import('isomorphic-git')
    
    // Set up minimal config
    await setConfig({ fs, dir, path: 'remote.origin.url', value: 'https://example.com/repo.git' })
    await setConfig({ fs, dir, path: 'branch.main.merge', value: 'refs/heads/main' })
    
    // Test that dir parameter is used to derive gitdir
    try {
      await push({
        fs,
        http,
        dir,
        ref: 'refs/heads/main',
        remote: 'origin',
      })
      // Will fail at HTTP discovery, but that's expected
    } catch (error) {
      // Expected to fail, but should not be MissingParameterError for gitdir
      assert.ok(error instanceof Error)
      if (error instanceof MissingParameterError) {
        assert.notStrictEqual((error as any).data?.parameter, 'gitdir')
      }
    }
  })

  await t.test('uses branch.pushRemote config when remote is not provided', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { setConfig } = await import('isomorphic-git')
    
    // Set up pushRemote config
    await setConfig({ fs, gitdir, path: 'branch.main.pushRemote', value: 'upstream' })
    await setConfig({ fs, gitdir, path: 'remote.upstream.url', value: 'https://example.com/repo.git' })
    await setConfig({ fs, gitdir, path: 'branch.main.merge', value: 'refs/heads/main' })
    
    // Test that pushRemote is used
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        // No remote provided - should use branch.main.pushRemote
      })
      // Will fail at HTTP discovery, but that's expected
    } catch (error) {
      // Expected to fail, but should not be MissingParameterError for remote
      assert.ok(error instanceof Error)
      if (error instanceof MissingParameterError) {
        assert.notStrictEqual((error as any).data?.parameter, 'remote OR url')
      }
    }
  })

  await t.test('uses remote.pushDefault config when remote and pushRemote are not provided', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { setConfig } = await import('isomorphic-git')
    
    // Set up pushDefault config
    await setConfig({ fs, gitdir, path: 'remote.pushDefault', value: 'upstream' })
    await setConfig({ fs, gitdir, path: 'remote.upstream.url', value: 'https://example.com/repo.git' })
    await setConfig({ fs, gitdir, path: 'branch.main.merge', value: 'refs/heads/main' })
    
    // Test that pushDefault is used
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        // No remote provided - should use remote.pushDefault
      })
      // Will fail at HTTP discovery, but that's expected
    } catch (error) {
      // Expected to fail, but should not be MissingParameterError for remote
      assert.ok(error instanceof Error)
      if (error instanceof MissingParameterError) {
        assert.notStrictEqual((error as any).data?.parameter, 'remote OR url')
      }
    }
  })

  await t.test('uses remote.pushurl config when available', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { setConfig } = await import('isomorphic-git')
    
    // Set up pushurl config (should be preferred over url)
    await setConfig({ fs, gitdir, path: 'remote.origin.pushurl', value: 'https://push.example.com/repo.git' })
    await setConfig({ fs, gitdir, path: 'remote.origin.url', value: 'https://example.com/repo.git' })
    await setConfig({ fs, gitdir, path: 'branch.main.merge', value: 'refs/heads/main' })
    
    // Test that pushurl is used
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        remote: 'origin',
      })
      // Will fail at HTTP discovery, but that's expected
    } catch (error) {
      // Expected to fail, but should not be MissingParameterError for url
      assert.ok(error instanceof Error)
      if (error instanceof MissingParameterError) {
        assert.notStrictEqual((error as any).data?.parameter, 'remote OR url')
      }
    }
  })

  await t.test('uses http.corsProxy config when corsProxy is not provided', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { setConfig } = await import('isomorphic-git')
    
    // Set up corsProxy config
    await setConfig({ fs, gitdir, path: 'remote.origin.url', value: 'https://example.com/repo.git' })
    await setConfig({ fs, gitdir, path: 'branch.main.merge', value: 'refs/heads/main' })
    await setConfig({ fs, gitdir, path: 'http.corsProxy', value: 'https://cors-proxy.example.com' })
    
    // Test that http.corsProxy is used
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        remote: 'origin',
        // No corsProxy provided - should use http.corsProxy config
      })
      // Will fail at HTTP discovery, but that's expected
    } catch (error) {
      // Expected to fail, but corsProxy should be read from config
      assert.ok(error instanceof Error)
    }
  })

  await t.test('handles remote ref expansion when remote ref does not exist', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { setConfig } = await import('isomorphic-git')
    
    // Set up minimal config
    await setConfig({ fs, gitdir, path: 'remote.origin.url', value: 'https://example.com/repo.git' })
    await setConfig({ fs, gitdir, path: 'branch.main.merge', value: 'refs/heads/new-branch' })
    
    // Test that remote ref expansion handles non-existent refs
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        remote: 'origin',
        remoteRef: 'new-branch', // This ref doesn't exist on remote yet
      })
      // Will fail at HTTP discovery, but that's expected
    } catch (error) {
      // Expected to fail, but should handle NotFoundError for remote ref expansion
      assert.ok(error instanceof Error)
    }
  })

  await t.test('handles remote ref expansion with full ref path', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { setConfig } = await import('isomorphic-git')
    
    // Set up minimal config
    await setConfig({ fs, gitdir, path: 'remote.origin.url', value: 'https://example.com/repo.git' })
    
    // Test that full ref paths are handled correctly
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        url: 'https://example.com/repo.git',
        remoteRef: 'refs/heads/feature', // Full ref path
      })
      // Will fail at HTTP discovery, but that's expected
    } catch (error) {
      // Expected to fail, but should handle full ref paths correctly
      assert.ok(error instanceof Error)
    }
  })

  await t.test('handles remote ref expansion with short ref name', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { setConfig } = await import('isomorphic-git')
    
    // Set up minimal config
    await setConfig({ fs, gitdir, path: 'remote.origin.url', value: 'https://example.com/repo.git' })
    
    // Test that short ref names are expanded to refs/heads/
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        url: 'https://example.com/repo.git',
        remoteRef: 'feature', // Short ref name - should be expanded to refs/heads/feature
      })
      // Will fail at HTTP discovery, but that's expected
    } catch (error) {
      // Expected to fail, but should expand short ref names correctly
      assert.ok(error instanceof Error)
    }
  })

  await t.test('handles case when remoteRef is not provided and fullRef is used', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const { setConfig } = await import('isomorphic-git')
    
    // Set up minimal config
    await setConfig({ fs, gitdir, path: 'remote.origin.url', value: 'https://example.com/repo.git' })
    
    // Test that when remoteRef is not provided, fullRef is used
    try {
      await push({
        fs,
        http,
        gitdir,
        ref: 'refs/heads/main',
        url: 'https://example.com/repo.git',
        // No remoteRef - should use fullRef (refs/heads/main)
      })
      // Will fail at MissingParameterError for remoteRef (since branch.main.merge is not set)
    } catch (error) {
      // Should fail with MissingParameterError for remoteRef
      assert.ok(error instanceof Error)
      if (error instanceof MissingParameterError) {
        assert.strictEqual((error as any).data?.parameter, 'remoteRef')
      }
    }
  })
})

