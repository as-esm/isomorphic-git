import { test } from 'node:test'
import assert from 'node:assert'
import { compareStrings } from '../../src/utils/compareStrings.ts'

test('compareStrings', async (t) => {
  await t.test('compares strings correctly', () => {
    assert.strictEqual(compareStrings('a', 'b'), -1)
    assert.strictEqual(compareStrings('b', 'a'), 1)
    assert.strictEqual(compareStrings('a', 'a'), 0)
  })

  await t.test('handles case sensitivity', () => {
    assert.strictEqual(compareStrings('A', 'a'), -1)
    assert.strictEqual(compareStrings('a', 'A'), 1)
  })

  await t.test('handles empty strings', () => {
    assert.strictEqual(compareStrings('', 'a'), -1)
    assert.strictEqual(compareStrings('a', ''), 1)
    assert.strictEqual(compareStrings('', ''), 0)
  })

  await t.test('handles numeric strings', () => {
    assert.strictEqual(compareStrings('1', '2'), -1)
    assert.strictEqual(compareStrings('10', '2'), -1) // Lexicographic comparison
  })
})

