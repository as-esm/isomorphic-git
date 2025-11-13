import { test } from 'node:test'
import assert from 'node:assert'
import { init, getConfig, setConfig } from 'isomorphic-git'
import { makeFixture } from './helpers/fixture.ts'

test('init', async (t) => {
  await t.test('init', async () => {
    const { fs, dir } = await makeFixture('test-init')
    await init({ fs, dir })
    assert.ok(await fs.exists(dir))
    assert.ok(await fs.exists(`${dir}/.git/objects`))
    assert.ok(await fs.exists(`${dir}/.git/refs/heads`))
    assert.ok(await fs.exists(`${dir}/.git/HEAD`))
  })

  await t.test('init --bare', async () => {
    const { fs, dir } = await makeFixture('test-init')
    await init({ fs, dir, bare: true })
    assert.ok(await fs.exists(dir))
    assert.ok(await fs.exists(`${dir}/objects`))
    assert.ok(await fs.exists(`${dir}/refs/heads`))
    assert.ok(await fs.exists(`${dir}/HEAD`))
  })

  await t.test('init does not overwrite existing config', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-init')
    const name = 'me'
    const email = 'meme'
    await init({ fs, dir })
    assert.ok(await fs.exists(dir))
    assert.ok(await fs.exists(`${dir}/.git/config`))
    await setConfig({ fs, dir, path: 'user.name', value: name })
    await setConfig({ fs, dir, path: 'user.email', value: email })
    // Test
    await init({ fs, dir })
    assert.ok(await fs.exists(dir))
    assert.ok(await fs.exists(`${dir}/.git/config`))
    // check that the properties we added are still there.
    assert.strictEqual(await getConfig({ fs, dir, path: 'user.name' }), name)
    assert.strictEqual(await getConfig({ fs, dir, path: 'user.email' }), email)
  })
})

