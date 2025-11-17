import { test } from 'node:test'
import assert from 'node:assert'
import { Errors, getRemoteInfo } from 'isomorphic-git'
import { createMockHttpClient } from '../helpers/mockHttpServer.ts'

test('getRemoteInfo', async (t) => {
  await t.test('getRemoteInfo', async () => {
    const http = await createMockHttpClient('test-dumb-http-server')
    const info = await getRemoteInfo({
      http,
      url: 'http://localhost/test-dumb-http-server.git',
    })
    
    assert.ok(info, 'Info should not be null')
    assert.ok(info.capabilities, 'Capabilities should not be null')
    assert.ok(info.refs, 'Refs should not be null')
    
    // Verify refs structure
    assert.ok(info.refs.heads, 'Should have heads refs')
    assert.strictEqual(info.refs.heads.master, '97c024f73eaab2781bf3691597bc7c833cb0e22f', 'master should have correct OID')
    assert.strictEqual(info.refs.heads.test, '5a8905a02e181fe1821068b8c0f48cb6633d5b81', 'test should have correct OID')
  })

  await t.test('throws UnknownTransportError if using shorter scp-like syntax', async () => {
    const http = await createMockHttpClient('test-dumb-http-server')
    let err: unknown
    try {
      await getRemoteInfo({
        http,
        url: 'git@github.com:isomorphic-git/isomorphic-git.git',
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

