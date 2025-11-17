import { test } from 'node:test'
import assert from 'node:assert'
import { clone } from 'isomorphic-git'
import http from '../../src/http/node/index.ts'
import { makeFixture } from '../helpers/fixture.ts'

test('huge repo clone and checkout', async (t) => {
  await t.test('clone from git-http-mock-server with non-blocking optimization for repo with 1k files', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-clone-karma-non-blocking')
    const branchName = 'main1k'

    await clone({
      fs,
      http,
      dir,
      gitdir,
      depth: 10,
      ref: branchName,
      singleBranch: true,
      url: 'https://github.com/isomorphic-git/dummy-huge-repo.git',
      corsProxy: undefined, // Not needed for Node.js tests
      nonBlocking: true,
    })

    assert.strictEqual(await fs.exists(`${dir}`), true, `'dir' exists`)
    assert.strictEqual(await fs.exists(`${gitdir}/objects`), true, `'gitdir/objects' exists`)
    assert.strictEqual(await fs.exists(`${gitdir}/refs/heads/${branchName}`), true, `'gitdir/refs/heads/${branchName}' exists`)
    assert.strictEqual(await fs.exists(`${dir}/package.json`), true, `'package.json' exists`)
  })
})

