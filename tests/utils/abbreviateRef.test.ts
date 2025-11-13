import { test } from 'node:test'
import assert from 'node:assert'
import { abbreviateRef } from '../../src/utils/abbreviateRef.ts'

test('abbreviateRef', async (t) => {
  await t.test('abbreviates refs/heads/branch', () => {
    assert.strictEqual(abbreviateRef('refs/heads/master'), 'master')
    assert.strictEqual(abbreviateRef('refs/heads/feature'), 'feature')
  })

  await t.test('abbreviates refs/tags/tag', () => {
    assert.strictEqual(abbreviateRef('refs/tags/v1.0.0'), 'v1.0.0')
  })

  await t.test('abbreviates refs/remotes/remote/branch', () => {
    assert.strictEqual(abbreviateRef('refs/remotes/origin/master'), 'origin/master')
  })

  await t.test('abbreviates refs/remotes/remote/HEAD', () => {
    assert.strictEqual(abbreviateRef('refs/remotes/origin/HEAD'), 'origin')
  })

  await t.test('returns original for non-refs paths', () => {
    assert.strictEqual(abbreviateRef('HEAD'), 'HEAD')
    assert.strictEqual(abbreviateRef('master'), 'master')
  })
})

