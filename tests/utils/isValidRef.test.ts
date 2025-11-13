import { test } from 'node:test'
import assert from 'node:assert'
import isValidRef from '../../src/utils/isValidRef.ts'

test('isValidRef', async (t) => {
  await t.test('validates ref names with slashes', () => {
    assert.strictEqual(isValidRef('refs/heads/master'), true)
    assert.strictEqual(isValidRef('refs/tags/v1.0.0'), true)
    assert.strictEqual(isValidRef('heads/feature-branch'), true)
  })

  await t.test('rejects invalid ref names', () => {
    assert.strictEqual(isValidRef(''), false)
    assert.strictEqual(isValidRef('refs/heads/master.lock'), false) // .lock suffix
    assert.strictEqual(isValidRef('refs/heads/..'), false) // contains ..
  })

  await t.test('handles onelevel parameter for single-level refs', () => {
    // With onelevel=true, single-level refs are valid
    assert.strictEqual(isValidRef('HEAD', true), true)
    assert.strictEqual(isValidRef('master', true), true)
    // With onelevel=false (default), single-level refs are invalid
    assert.strictEqual(isValidRef('master'), false)
    assert.strictEqual(isValidRef('HEAD'), false)
  })

  await t.test('rejects refs with invalid characters', () => {
    assert.strictEqual(isValidRef('refs/heads/branch with space'), false)
    assert.strictEqual(isValidRef('refs/heads/branch\n'), false)
  })
})

