import { test } from 'node:test'
import assert from 'node:assert'
import { GitConfig } from '../../../src/models/GitConfig.ts'
import { makeFixture } from '../../helpers/fixture.ts'

test('GitConfig', async (t) => {
  await t.test('parse config file', async () => {
    const configText = `[core]
	filemode = true
	bare = false
	repositoryformatversion = 0

[remote "origin"]
	url = https://github.com/isomorphic-git/isomorphic-git
	fetch = +refs/heads/master:refs/remotes/origin/master
`
    const config = GitConfig.from(configText)
    
    assert.strictEqual(await config.get('core.filemode'), true)
    assert.strictEqual(await config.get('core.bare'), false)
    assert.strictEqual(await config.get('core.repositoryformatversion'), '0')
    assert.strictEqual(await config.get('remote.origin.url'), 'https://github.com/isomorphic-git/isomorphic-git')
  })

  await t.test('get and set values', async () => {
    const config = GitConfig.from('[core]\n\tfilemode = true\n')
    
    assert.strictEqual(await config.get('core.filemode'), true)
    
    await config.set('core.bare', true)
    assert.strictEqual(await config.get('core.bare'), true)
    
    await config.set('core.bare', false)
    assert.strictEqual(await config.get('core.bare'), false)
  })

  await t.test('getall returns all values for multi-value keys', async () => {
    const configText = `[remote "upstream"]
	fetch = +refs/heads/master:refs/remotes/upstream/master
	fetch = refs/heads/develop:refs/remotes/upstream/develop
	fetch = refs/heads/qa/*:refs/remotes/upstream/qa/*
`
    const config = GitConfig.from(configText)
    const fetches = await config.getall('remote.upstream.fetch')
    
    assert.deepStrictEqual(fetches, [
      '+refs/heads/master:refs/remotes/upstream/master',
      'refs/heads/develop:refs/remotes/upstream/develop',
      'refs/heads/qa/*:refs/remotes/upstream/qa/*',
    ])
  })

  await t.test('append adds new value', async () => {
    const config = GitConfig.from('[remote "origin"]\n\turl = https://example.com\n')
    
    await config.append('remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*')
    const fetches = await config.getall('remote.origin.fetch')
    
    assert.deepStrictEqual(fetches, ['+refs/heads/*:refs/remotes/origin/*'])
  })

  await t.test('deleteSection removes section', async () => {
    const config = GitConfig.from('[core]\n\tfilemode = true\n[remote "origin"]\n\turl = https://example.com\n')
    
    assert.ok(await config.get('remote.origin.url'))
    await config.deleteSection('remote', 'origin')
    assert.strictEqual(await config.get('remote.origin.url'), undefined)
    assert.strictEqual(await config.get('core.filemode'), true) // Other sections remain
  })

  await t.test('toString preserves format', async () => {
    const configText = `[core]
	filemode = true
	bare = false
`
    const config = GitConfig.from(configText)
    const output = config.toString()
    
    assert.ok(output.includes('[core]'))
    assert.ok(output.includes('filemode = true'))
    assert.ok(output.includes('bare = false'))
  })

  await t.test('handles quoted values', async () => {
    const configText = `[core]
	editor = "vim -c 'set ft=gitcommit'"
`
    const config = GitConfig.from(configText)
    assert.strictEqual(await config.get('core.editor'), "vim -c 'set ft=gitcommit'")
  })

  await t.test('handles implicit boolean values', async () => {
    const configText = `[core]
	filemode
`
    const config = GitConfig.from(configText)
    assert.strictEqual(await config.get('core.filemode'), true)
  })
})

