import { test } from 'node:test'
import assert from 'node:assert'
import { fromEntries } from '../../src/utils/fromEntries.ts'

test('fromEntries', async (t) => {
  await t.test('convert map to object', () => {
    const map = new Map<string, string>()
    map.set('key1', 'value1')
    map.set('key2', 'value2')
    map.set('key3', 'value3')

    const result = fromEntries(map)

    assert.strictEqual(result.key1, 'value1')
    assert.strictEqual(result.key2, 'value2')
    assert.strictEqual(result.key3, 'value3')
    assert.strictEqual(Object.keys(result).length, 3)
  })

  await t.test('convert empty map', () => {
    const map = new Map<string, string>()
    const result = fromEntries(map)

    assert.strictEqual(Object.keys(result).length, 0)
  })

  await t.test('convert map with single entry', () => {
    const map = new Map<string, string>()
    map.set('single', 'value')

    const result = fromEntries(map)

    assert.strictEqual(result.single, 'value')
    assert.strictEqual(Object.keys(result).length, 1)
  })

  await t.test('convert map with duplicate keys (last wins)', () => {
    const map = new Map<string, string>()
    map.set('key', 'value1')
    map.set('key', 'value2') // Overwrites previous

    const result = fromEntries(map)

    assert.strictEqual(result.key, 'value2')
    assert.strictEqual(Object.keys(result).length, 1)
  })

  await t.test('convert map with special characters in keys', () => {
    const map = new Map<string, string>()
    map.set('key-with-dash', 'value1')
    map.set('key_with_underscore', 'value2')
    map.set('key.with.dot', 'value3')

    const result = fromEntries(map)

    assert.strictEqual(result['key-with-dash'], 'value1')
    assert.strictEqual(result['key_with_underscore'], 'value2')
    assert.strictEqual(result['key.with.dot'], 'value3')
  })

  await t.test('convert map with empty string values', () => {
    const map = new Map<string, string>()
    map.set('key1', '')
    map.set('key2', 'value')

    const result = fromEntries(map)

    assert.strictEqual(result.key1, '')
    assert.strictEqual(result.key2, 'value')
  })
})

