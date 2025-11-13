import { test } from 'node:test'
import assert from 'node:assert'
import { getConfig, getConfigAll, setConfig } from 'isomorphic-git'
import { makeFixture } from './helpers/fixture.ts'

test('config', async (t) => {
  await t.test('getting', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-config')
    // Test
    const sym = await getConfig({ fs, gitdir, path: 'core.symlinks' })
    const rfv = await getConfig({
      fs,
      gitdir,
      path: 'core.repositoryformatversion',
    })
    const url = await getConfig({ fs, gitdir, path: 'remote.origin.url' })
    const fetch = await getConfig({ fs, gitdir, path: 'remote.upstream.fetch' })
    const fetches = await getConfigAll({
      fs,
      gitdir,
      path: 'remote.upstream.fetch',
    })
    assert.strictEqual(sym, false)
    assert.strictEqual(url, 'https://github.com/isomorphic-git/isomorphic-git')
    assert.strictEqual(rfv, '0')
    assert.strictEqual(fetch, 'refs/heads/qa/*:refs/remotes/upstream/qa/*')
    assert.deepStrictEqual(fetches, [
      '+refs/heads/master:refs/remotes/upstream/master',
      'refs/heads/develop:refs/remotes/upstream/develop',
      'refs/heads/qa/*:refs/remotes/upstream/qa/*',
    ])
  })

  await t.test('setting', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-config')
    // Test
    let bare: unknown
    // set to true
    await setConfig({ fs, gitdir, path: 'core.bare', value: true })
    bare = await getConfig({ fs, gitdir, path: 'core.bare' })
    assert.strictEqual(bare, true)
    // set to false
    await setConfig({ fs, gitdir, path: 'core.bare', value: false })
    bare = await getConfig({ fs, gitdir, path: 'core.bare' })
    assert.strictEqual(bare, false)
    // set to undefined
    await setConfig({ fs, gitdir, path: 'core.bare', value: undefined })
    bare = await getConfig({ fs, gitdir, path: 'core.bare' })
    assert.strictEqual(bare, undefined)
  })
})

