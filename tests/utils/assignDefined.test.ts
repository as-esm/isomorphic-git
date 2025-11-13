import { test } from 'node:test'
import assert from 'node:assert'
import { assignDefined } from '../../src/utils/assignDefined.ts'

test('assignDefined', async (t) => {
  await t.test('assigns defined properties', () => {
    const result = assignDefined({}, { a: 1, b: 2 }, { c: 3 })
    assert.deepStrictEqual(result, { a: 1, b: 2, c: 3 })
  })

  await t.test('skips undefined properties', () => {
    const result = assignDefined({}, { a: 1, b: undefined }, { c: 3 })
    assert.deepStrictEqual(result, { a: 1, c: 3 })
  })

  await t.test('includes null properties (only skips undefined)', () => {
    const result = assignDefined({}, { a: 1, b: null }, { c: 3 })
    // assignDefined only skips undefined, not null
    assert.deepStrictEqual(result, { a: 1, b: null, c: 3 })
  })

  await t.test('handles empty objects', () => {
    const result = assignDefined({}, {}, {})
    assert.deepStrictEqual(result, {})
  })

  await t.test('overwrites with later values', () => {
    const result = assignDefined({}, { a: 1 }, { a: 2 })
    assert.deepStrictEqual(result, { a: 2 })
  })
})

