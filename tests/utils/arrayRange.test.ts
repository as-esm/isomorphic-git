import { test } from 'node:test'
import assert from 'node:assert'
import { arrayRange } from '../../src/utils/arrayRange.ts'

test('arrayRange', async (t) => {
  await t.test('creates range from start to end', () => {
    const result = arrayRange(0, 5)
    assert.deepStrictEqual(result, [0, 1, 2, 3, 4])
  })

  await t.test('handles single element range', () => {
    const result = arrayRange(0, 1)
    assert.deepStrictEqual(result, [0])
  })

  await t.test('handles empty range', () => {
    const result = arrayRange(0, 0)
    assert.deepStrictEqual(result, [])
  })

  await t.test('handles negative start', () => {
    const result = arrayRange(-2, 2)
    assert.deepStrictEqual(result, [-2, -1, 0, 1])
  })
})

