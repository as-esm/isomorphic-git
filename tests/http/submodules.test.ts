import { test } from 'node:test'
import assert from 'node:assert'
import { clone, checkout, listFiles, commit } from 'isomorphic-git'
import { createMockHttpClient } from '../helpers/mockHttpServer.ts'
import { makeFixture } from '../helpers/fixture.ts'

test('submodule support', async (t) => {
  await t.test('submodules are still staged after fresh clone', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-clone-submodules')
    const http = await createMockHttpClient('test-submodules')
    
    await clone({
      fs,
      http,
      dir,
      gitdir,
      url: 'http://localhost/test-submodules.git',
      noCheckout: false,
    })
    
    // Test
    const files = await listFiles({ fs, gitdir })
    assert.ok(files.includes('test.empty'), 'Should contain test.empty submodule')
  })

  await t.test('submodules are still staged after making a commit', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-clone-submodules')
    const http = await createMockHttpClient('test-submodules')
    
    await clone({
      fs,
      http,
      dir,
      gitdir,
      url: 'http://localhost/test-submodules.git',
      noCheckout: false,
    })
    
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
      message: 'test commit',
    })
    
    const files = await listFiles({ fs, gitdir })
    assert.ok(files.includes('test.empty'), 'Should contain test.empty submodule after commit')
  })

  await t.test('submodules are staged when switching to a branch that has them', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-clone-submodules')
    const http = await createMockHttpClient('test-submodules')
    
    await clone({
      fs,
      http,
      dir,
      gitdir,
      ref: 'no-modules',
      url: 'http://localhost/test-submodules.git',
      noCheckout: false,
    })
    
    // Test
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'master',
    })
    
    const files = await listFiles({ fs, gitdir })
    assert.ok(files.includes('test.empty'), 'Should contain test.empty when switching to master branch')
  })

  await t.test("submodules are unstaged when switching to a branch that doesn't have them", async () => {
    const { fs, dir, gitdir } = await makeFixture('test-clone-submodules')
    const http = await createMockHttpClient('test-submodules')
    
    await clone({
      fs,
      http,
      dir,
      gitdir,
      url: 'http://localhost/test-submodules.git',
      noCheckout: false,
    })
    
    // Test
    await checkout({ fs, dir, gitdir, ref: 'no-modules' })
    
    const files = await listFiles({ fs, gitdir })
    assert.strictEqual(files.includes('test.empty'), false, 'Should not contain test.empty when switching to no-modules branch')
  })
})

