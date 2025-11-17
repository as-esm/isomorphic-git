import { test } from 'node:test'
import assert from 'node:assert'
import { Errors, setConfig, fetch } from 'isomorphic-git'
import { createMockHttpClient } from '../helpers/mockHttpServer.ts'
import { makeFixture } from '../helpers/fixture.ts'

test('fetch', async (t) => {
  await t.test('fetch from mock server', async () => {
    const { fs, gitdir } = await makeFixture('test-fetch-server')
    const http = await createMockHttpClient('test-fetch-server')
    
    await setConfig({
      fs,
      gitdir,
      path: 'remote.origin.url',
      value: 'http://localhost/test-fetch-server.git',
    })
    
    // Test
    await fetch({
      fs,
      http,
      gitdir,
      singleBranch: true,
      remote: 'origin',
      ref: 'master',
    })
    
    assert.ok(await fs.exists(`${gitdir}/refs/remotes/origin/master`), 'Should have remote ref')
    assert.strictEqual(await fs.exists(`${gitdir}/refs/remotes/origin/test`), false, 'Should not have other branches when singleBranch is true')
  })

  await t.test('fetch empty repository', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    const http = await createMockHttpClient('test-empty')
    
    await fetch({
      fs,
      http,
      dir,
      gitdir,
      depth: 1,
      url: 'http://localhost/test-empty.git',
    })
    
    assert.ok(await fs.exists(dir), 'Directory should exist')
    assert.ok(await fs.exists(`${gitdir}/HEAD`), 'HEAD should exist')
    const head = (await fs.read(`${gitdir}/HEAD`)).toString('utf-8').trim()
    assert.strictEqual(head, 'ref: refs/heads/master', 'HEAD should point to master')
    assert.strictEqual(await fs.exists(`${gitdir}/refs/heads/master`), false, 'Master branch should not exist in empty repo')
  })

  await t.test('fetch --prune', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-fetch-client')
    const http = await createMockHttpClient('test-fetch-server')
    
    await setConfig({
      fs,
      gitdir,
      path: 'remote.origin.url',
      value: 'http://localhost/test-fetch-server.git',
    })
    
    // Verify test-prune ref exists before pruning
    assert.ok(await fs.exists(`${gitdir}/refs/remotes/origin/test-prune`), 'test-prune should exist before prune')
    
    const { pruned } = await fetch({
      fs,
      http,
      dir,
      gitdir,
      depth: 1,
      prune: true,
    })
    
    assert.ok(pruned, 'Should return pruned refs')
    assert.ok(Array.isArray(pruned), 'Pruned should be an array')
    assert.ok(pruned.length > 0, 'Should have pruned at least one ref')
    assert.strictEqual(await fs.exists(`${gitdir}/refs/remotes/origin/test-prune`), false, 'test-prune should be removed after prune')
  })

  await t.test('throws UnknownTransportError if using shorter scp-like syntax', async () => {
    const { fs, gitdir } = await makeFixture('test-fetch-server')
    const http = await createMockHttpClient('test-fetch-server')
    
    await setConfig({
      fs,
      gitdir,
      path: 'remote.ssh.url',
      value: 'git@github.com:isomorphic-git/isomorphic-git.git',
    })
    
    let err: unknown
    try {
      await fetch({
        fs,
        http,
        gitdir,
        depth: 1,
        singleBranch: true,
        remote: 'ssh',
        ref: 'master',
      })
      assert.fail('Should have thrown an error')
    } catch (e) {
      err = e
    }
    
    assert.ok(err, 'Error should be defined')
    assert.ok(err instanceof Errors.UnknownTransportError, 'Should throw UnknownTransportError')
    if (err instanceof Errors.UnknownTransportError) {
      assert.strictEqual(err.code, Errors.UnknownTransportError.code, 'Error code should match')
    }
  })
})

