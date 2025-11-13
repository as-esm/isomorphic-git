import { test } from 'node:test'
import assert from 'node:assert'
import { isPromiseLike } from '../../src/utils/types.ts'

test('isPromiseLike', async (t) => {
  await t.test('identifies promises', () => {
    assert.strictEqual(isPromiseLike(Promise.resolve(1)), true)
    assert.strictEqual(isPromiseLike(new Promise(() => {})), true)
  })

  await t.test('rejects non-promises', () => {
    assert.strictEqual(isPromiseLike({}), false)
    assert.strictEqual(isPromiseLike([]), false)
    assert.strictEqual(isPromiseLike('string'), false)
    assert.strictEqual(isPromiseLike(123), false)
    assert.strictEqual(isPromiseLike(null), false)
    assert.strictEqual(isPromiseLike(undefined), false)
  })

  await t.test('rejects thenables without proper structure', () => {
    // Objects with then that aren't actually promises
    assert.strictEqual(isPromiseLike({ then: 'not a function' }), false)
    // Objects with then but no catch
    assert.strictEqual(isPromiseLike({ then: () => {} }), false)
    // Objects with both then and catch as functions
    assert.strictEqual(isPromiseLike({ then: () => {}, catch: () => {} }), true)
  })
})

