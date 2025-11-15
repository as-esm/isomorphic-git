import { describe, it } from 'node:test'
import assert from 'node:assert'
import { setConfig } from 'isomorphic-git'
import { normalizeAuthorObject } from '../../src/utils/normalizeAuthorObject.ts'
import { makeFixture } from '../helpers/fixture.ts'

describe('normalizeAuthorObject', () => {
  it('return author if all properties are populated', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-normalizeAuthorObject')

    await setConfig({
      fs,
      gitdir,
      path: 'user.name',
      value: `user-config`,
    })

    await setConfig({
      fs,
      gitdir,
      path: 'user.name',
      value: `user-config@example.com`,
    })

    // Test
    const author = {
      name: 'user',
      email: 'user@example.com',
      timestamp: 1720159690,
      timezoneOffset: -120,
    }

    assert.deepStrictEqual(await normalizeAuthorObject({ fs, gitdir, author }), author)
  })

  it('return commit author when no author was provided', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-normalizeAuthorObject')

    await setConfig({
      fs,
      gitdir,
      path: 'user.name',
      value: `user-config`,
    })

    await setConfig({
      fs,
      gitdir,
      path: 'user.email',
      value: `user-config@example.com`,
    })

    // Test
    const commit = {
      message: 'commit message',
      tree: '80655da8d80aaaf92ce5357e7828dc09adb00993', // Just random SHA-1
      parent: ['d8fd39d0bbdd2dcf322d8b11390a4c5825b11495'], // Just random SHA-1
      author: {
        name: 'commit-author',
        email: 'commit-author@example.com',
        timestamp: 1720169744,
        timezoneOffset: 60,
      },
      committer: {
        name: 'commit-commiter',
        email: 'commit-commiter@example.com',
        timestamp: 1720169744,
        timezoneOffset: 120,
      },
    }

    assert.deepStrictEqual(await normalizeAuthorObject({ fs, gitdir, commit }), commit.author)
  })

  it('return config values and new timestamp if no author or commit was provided', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-normalizeAuthorObject')

    await setConfig({
      fs,
      gitdir,
      path: 'user.name',
      value: `user-config`,
    })

    await setConfig({
      fs,
      gitdir,
      path: 'user.email',
      value: `user-config@example.com`,
    })

    // Test
    const author = await normalizeAuthorObject({ fs, gitdir })
    assert.strictEqual(author.name, 'user-config')
    assert.strictEqual(author.email, 'user-config@example.com')
    assert.strictEqual(typeof author.timestamp, 'number')
    assert.strictEqual(typeof author.timezoneOffset, 'number')
  })

  it('return undefined if no value can be retrieved', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-normalizeAuthorObject')

    // Test
    assert.strictEqual(await normalizeAuthorObject({ fs, gitdir }), undefined)
  })
})

