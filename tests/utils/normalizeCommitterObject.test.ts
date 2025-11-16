import { describe, it } from 'node:test'
import assert from 'node:assert'
import { setConfig } from 'isomorphic-git'
import { normalizeCommitterObject } from '../../src/utils/normalizeCommitterObject.ts'
import { makeFixture } from '../helpers/fixture.ts'
import { Repository } from '../../src/core-utils/Repository.ts'

describe('normalizeCommitterObject', () => {
  it('return committer if all properties are populated', async () => {
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

    const repo = await Repository.open({ fs, gitdir, cache: {}, autoDetectConfig: true })

    // Test
    const author = {
      name: 'user-author',
      email: 'user-author@example.com',
      timestamp: 1720159690,
      timezoneOffset: -120,
    }

    const committer = {
      name: 'user-committer',
      email: 'user-committer@example.com',
      timestamp: 1720165308,
      timezoneOffset: -60,
    }

    assert.deepStrictEqual(
      await normalizeCommitterObject({ repo, author, committer }),
      committer
    )
  })

  it('return author values if no committer was provided', async () => {
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

    const repo = await Repository.open({ fs, gitdir, cache: {}, autoDetectConfig: true })

    // Test
    const author = {
      name: 'user-author',
      email: 'user-author@example.com',
      timestamp: 1720159690,
      timezoneOffset: -120,
    }

    assert.deepStrictEqual(await normalizeCommitterObject({ repo, author }), author)
  })

  it('return commit committer when no author or committer was provided', async () => {
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

    const repo = await Repository.open({ fs, gitdir, cache: {}, autoDetectConfig: true })

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

    assert.deepStrictEqual(await normalizeCommitterObject({ repo, commit }), commit.committer)
  })

  it('return config values and new timestamp if no author or committer was provided', async () => {
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

    const repo = await Repository.open({ fs, gitdir, cache: {}, autoDetectConfig: true })

    // Test
    const committer = await normalizeCommitterObject({ repo })
    assert.strictEqual(committer.name, 'user-config')
    assert.strictEqual(committer.email, 'user-config@example.com')
    assert.strictEqual(typeof committer.timestamp, 'number')
    assert.strictEqual(typeof committer.timezoneOffset, 'number')
  })

  it('return undefined if no value can be retrieved', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-normalizeAuthorObject')

    // Disable auto-detection of global/system config to ensure no config values are found
    const repo = await Repository.open({ fs, gitdir, cache: {}, autoDetectConfig: false })

    // Test
    assert.strictEqual(await normalizeCommitterObject({ repo }), undefined)
  })
})

