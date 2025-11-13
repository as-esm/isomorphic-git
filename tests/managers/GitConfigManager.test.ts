import { test } from 'node:test'
import assert from 'node:assert'
import { GitConfigManager } from '../../src/managers/GitConfigManager.ts'
import { GitConfig } from '../../src/models/GitConfig.ts'
import { makeFixture } from '../helpers/fixture.ts'

test('GitConfigManager', async (t) => {
  await t.test('get reads config from file', async () => {
    const { fs, gitdir } = await makeFixture('test-config')
    
    const config = await GitConfigManager.get({ fs, gitdir })
    
    assert.ok(config instanceof GitConfig)
    assert.strictEqual(await config.get('core.repositoryformatversion'), '0')
  })

  await t.test('save writes config to file', async () => {
    const { fs, gitdir } = await makeFixture('test-config')
    
    const config = await GitConfigManager.get({ fs, gitdir })
    await config.set('core.test', 'value')
    await GitConfigManager.save({ fs, gitdir, config })
    
    const reloaded = await GitConfigManager.get({ fs, gitdir })
    assert.strictEqual(await reloaded.get('core.test'), 'value')
  })

  await t.test('get throws error if config file does not exist', async () => {
    const { fs, gitdir } = await makeFixture('test-empty')
    
    // Delete the config file to test the error case
    const configPath = `${gitdir}/config`
    if (await fs.exists(configPath)) {
      await fs.rm(configPath)
    }
    
    let error: unknown = null
    try {
      await GitConfigManager.get({ fs, gitdir })
    } catch (err) {
      error = err
    }
    
    assert.notStrictEqual(error, null)
  })
})

