import { test } from 'node:test'
import assert from 'node:assert'
import { filterCapabilities } from '../../src/utils/filterCapabilities.ts'

test('filterCapabilities', async (t) => {
  await t.test('filters client capabilities to match server capabilities', () => {
    const server = ['cap1', 'cap2', 'cap3']
    const client = ['cap1', 'cap2', 'cap4', 'cap5']
    const result = filterCapabilities(server, client)
    assert.deepStrictEqual(result, ['cap1', 'cap2'])
  })

  await t.test('handles capabilities with values', () => {
    const server = ['cap1=value1', 'cap2=value2', 'cap3']
    const client = ['cap1=other', 'cap2=different', 'cap4=value']
    const result = filterCapabilities(server, client)
    // Should match based on capability name (before =), not value
    assert.deepStrictEqual(result, ['cap1=other', 'cap2=different'])
  })

  await t.test('returns empty array when no capabilities match', () => {
    const server = ['cap1', 'cap2']
    const client = ['cap3', 'cap4']
    const result = filterCapabilities(server, client)
    assert.deepStrictEqual(result, [])
  })

  await t.test('returns all client capabilities when all match server', () => {
    const server = ['cap1', 'cap2', 'cap3']
    const client = ['cap1', 'cap2', 'cap3']
    const result = filterCapabilities(server, client)
    assert.deepStrictEqual(result, ['cap1', 'cap2', 'cap3'])
  })

  await t.test('handles empty server capabilities', () => {
    const server: string[] = []
    const client = ['cap1', 'cap2']
    const result = filterCapabilities(server, client)
    assert.deepStrictEqual(result, [])
  })

  await t.test('handles empty client capabilities', () => {
    const server = ['cap1', 'cap2']
    const client: string[] = []
    const result = filterCapabilities(server, client)
    assert.deepStrictEqual(result, [])
  })

  await t.test('handles both empty', () => {
    const server: string[] = []
    const client: string[] = []
    const result = filterCapabilities(server, client)
    assert.deepStrictEqual(result, [])
  })

  await t.test('preserves client capability values when filtering', () => {
    const server = ['cap1', 'cap2']
    const client = ['cap1=value1', 'cap2=value2', 'cap3=value3']
    const result = filterCapabilities(server, client)
    // Should preserve the values from client capabilities
    assert.deepStrictEqual(result, ['cap1=value1', 'cap2=value2'])
  })

  await t.test('handles capabilities with multiple equals signs', () => {
    const server = ['cap1', 'cap2']
    const client = ['cap1=value=with=equals', 'cap2=normal', 'cap3=other']
    const result = filterCapabilities(server, client)
    // Should split on first = only
    assert.deepStrictEqual(result, ['cap1=value=with=equals', 'cap2=normal'])
  })
})

