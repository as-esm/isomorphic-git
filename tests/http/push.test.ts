import { test } from 'node:test'
import assert from 'node:assert'
import { clone, setConfig, push, resolveRef } from 'isomorphic-git'
import { createMockHttpClient } from '../helpers/mockHttpServer.ts'
import { makeFixture } from '../helpers/fixture.ts'

test('push', async (t) => {
  await t.test('push', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const http = await createMockHttpClient('test-push-server')
    
    await setConfig({
      fs,
      gitdir,
      path: 'remote.karma.url',
      value: 'http://localhost/test-push-server.git',
    })
    await setConfig({
      fs,
      gitdir,
      path: 'branch.master.merge',
      value: 'refs/heads/master',
    })
    
    const output: string[] = []
    const onPrePush: any[] = []
    
    // Test
    const res = await push({
      fs,
      http,
      gitdir,
      onMessage: async (m) => {
        output.push(m)
      },
      remote: 'karma',
      ref: 'refs/heads/master',
      onPrePush: (args) => {
        onPrePush.push(args)
        return true
      },
    })
    
    assert.ok(res, 'Result should be truthy')
    assert.strictEqual(res.ok, true, 'Push should be successful')
    assert.ok(res.refs['refs/heads/master'], 'Should have ref status')
    assert.strictEqual(res.refs['refs/heads/master'].ok, true, 'Ref update should be successful')
    
    // Verify onPrePush was called
    assert.strictEqual(onPrePush.length, 1, 'onPrePush should be called once')
    assert.ok(onPrePush[0].localRef, 'onPrePush should have localRef')
    assert.ok(onPrePush[0].remoteRef, 'onPrePush should have remoteRef')
    assert.strictEqual(onPrePush[0].remote, 'karma', 'Remote should match')
    
    // Test that remote ref is updated
    const remoteRef = await resolveRef({ fs, gitdir, ref: 'refs/remotes/karma/master' })
    const localRef = await resolveRef({ fs, gitdir, ref: 'refs/heads/master' })
    assert.strictEqual(remoteRef, localRef, 'Remote ref should match local ref')
    assert.strictEqual(remoteRef, 'c03e131196f43a78888415924bcdcbf3090f3316', 'Remote ref should have correct OID')
  })

  await t.test('push empty', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-fetch-server')
    const http = await createMockHttpClient('test-fetch-server')
    
    await clone({
      fs,
      http,
      dir,
      gitdir,
      url: 'http://localhost/test-fetch-server.git',
    })
    
    await setConfig({
      fs,
      gitdir,
      path: 'branch.master.merge',
      value: 'refs/heads/master',
    })
    
    // Test
    const res = await push({
      fs,
      http,
      gitdir,
    })
    
    assert.ok(res, 'Result should be truthy')
    assert.strictEqual(res.ok, true, 'Push should be successful')
    assert.ok(res.refs['refs/heads/master'], 'Should have ref status')
    assert.strictEqual(res.refs['refs/heads/master'].ok, true, 'Ref update should be successful')
  })

  await t.test('push without ref', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const http = await createMockHttpClient('test-push-server')
    
    await setConfig({
      fs,
      gitdir,
      path: 'remote.karma.url',
      value: 'http://localhost/test-push-server.git',
    })
    await setConfig({
      fs,
      gitdir,
      path: 'branch.master.merge',
      value: 'refs/heads/master',
    })
    
    // Test
    const res = await push({
      fs,
      http,
      gitdir,
      remote: 'karma',
    })
    
    assert.ok(res, 'Result should be truthy')
    assert.strictEqual(res.ok, true, 'Push should be successful')
    assert.ok(res.refs['refs/heads/master'], 'Should have ref status')
    assert.strictEqual(res.refs['refs/heads/master'].ok, true, 'Ref update should be successful')
  })

  await t.test('push with ref !== remoteRef', async () => {
    const { fs, gitdir } = await makeFixture('test-push')
    const http = await createMockHttpClient('test-push-server')
    
    await setConfig({
      fs,
      gitdir,
      path: 'remote.karma.url',
      value: 'http://localhost/test-push-server.git',
    })
    
    const onPrePush: any[] = []
    
    // Test
    const res = await push({
      fs,
      http,
      gitdir,
      remote: 'karma',
      ref: 'master',
      remoteRef: 'foobar',
      onPrePush: (args) => {
        onPrePush.push(args)
        return true
      },
    })
    
    assert.ok(res, 'Result should be truthy')
    assert.strictEqual(res.ok, true, 'Push should be successful')
    assert.ok(res.refs['refs/heads/foobar'], 'Should have remoteRef status')
    assert.strictEqual(res.refs['refs/heads/foobar'].ok, true, 'Remote ref update should be successful')
    
    // Verify onPrePush was called with correct remoteRef
    assert.strictEqual(onPrePush.length, 1, 'onPrePush should be called once')
    assert.strictEqual(onPrePush[0].remoteRef.ref, 'refs/heads/foobar', 'Remote ref should match')
  })
})

