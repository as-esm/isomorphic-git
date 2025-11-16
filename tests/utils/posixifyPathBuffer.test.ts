import { test } from 'node:test'
import assert from 'node:assert'
import { posixifyPathBuffer } from '../../src/utils/posixifyPathBuffer.ts'

test('posixifyPathBuffer', async (t) => {
  await t.test('converts backslashes to forward slashes in Buffer', () => {
    const buffer = Buffer.from('path\\to\\file.txt', 'utf8')
    const result = posixifyPathBuffer(buffer)
    assert.ok(result instanceof Uint8Array)
    assert.strictEqual(Buffer.from(result).toString('utf8'), 'path/to/file.txt')
  })

  await t.test('converts backslashes to forward slashes in Uint8Array', () => {
    const array = new Uint8Array(Buffer.from('C:\\Users\\file.txt', 'utf8'))
    const result = posixifyPathBuffer(array)
    assert.ok(result instanceof Uint8Array)
    assert.strictEqual(Buffer.from(result).toString('utf8'), 'C:/Users/file.txt')
  })

  await t.test('handles multiple backslashes', () => {
    const buffer = Buffer.from('a\\b\\c\\d\\e.txt', 'utf8')
    const result = posixifyPathBuffer(buffer)
    assert.strictEqual(Buffer.from(result).toString('utf8'), 'a/b/c/d/e.txt')
  })

  await t.test('leaves forward slashes unchanged', () => {
    const buffer = Buffer.from('path/to/file.txt', 'utf8')
    const result = posixifyPathBuffer(buffer)
    assert.strictEqual(Buffer.from(result).toString('utf8'), 'path/to/file.txt')
  })

  await t.test('handles mixed separators', () => {
    const buffer = Buffer.from('path\\to/file\\name.txt', 'utf8')
    const result = posixifyPathBuffer(buffer)
    assert.strictEqual(Buffer.from(result).toString('utf8'), 'path/to/file/name.txt')
  })

  await t.test('handles empty buffer', () => {
    const buffer = Buffer.from('', 'utf8')
    const result = posixifyPathBuffer(buffer)
    assert.strictEqual(Buffer.from(result).toString('utf8'), '')
  })

  await t.test('handles buffer with no backslashes', () => {
    const buffer = Buffer.from('simplefilename', 'utf8')
    const result = posixifyPathBuffer(buffer)
    assert.strictEqual(Buffer.from(result).toString('utf8'), 'simplefilename')
  })

  await t.test('preserves other characters', () => {
    const buffer = Buffer.from('path\\to\\file-name_123.txt', 'utf8')
    const result = posixifyPathBuffer(buffer)
    assert.strictEqual(Buffer.from(result).toString('utf8'), 'path/to/file-name_123.txt')
  })

  await t.test('handles unicode characters', () => {
    const buffer = Buffer.from('path\\to\\файл.txt', 'utf8')
    const result = posixifyPathBuffer(buffer)
    assert.strictEqual(Buffer.from(result).toString('utf8'), 'path/to/файл.txt')
  })

  await t.test('returns Uint8Array for both input types', () => {
    const buffer = Buffer.from('test\\path', 'utf8')
    const uint8Array = new Uint8Array(Buffer.from('test\\path', 'utf8'))
    
    const result1 = posixifyPathBuffer(buffer)
    const result2 = posixifyPathBuffer(uint8Array)
    
    // The function always returns Uint8Array (converts Buffer to Uint8Array internally)
    assert.ok(result1 instanceof Uint8Array)
    assert.ok(!Buffer.isBuffer(result1))
    assert.ok(result2 instanceof Uint8Array)
    assert.ok(!Buffer.isBuffer(result2))
  })
})

