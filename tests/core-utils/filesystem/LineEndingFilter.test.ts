import { test } from 'node:test'
import assert from 'node:assert'
import {
  convertLineEndings,
  normalizeToLF,
  convertForWorkdir,
  convertForStorage,
} from '../../../src/core-utils/filesystem/LineEndingFilter.ts'

test('LineEndingFilter', async (t) => {
  await t.test('convertLineEndings - lf mode converts to LF', () => {
    const input = Buffer.from('line1\r\nline2\r\nline3')
    const result = convertLineEndings(input, 'lf')
    assert.strictEqual(result.toString('utf8'), 'line1\nline2\nline3')
  })

  await t.test('convertLineEndings - crlf mode converts to CRLF', () => {
    const input = Buffer.from('line1\nline2\nline3')
    const result = convertLineEndings(input, 'crlf')
    assert.strictEqual(result.toString('utf8'), 'line1\r\nline2\r\nline3')
  })

  await t.test('convertLineEndings - auto mode uses platform default (unix)', () => {
    const input = Buffer.from('line1\r\nline2\r\nline3')
    const result = convertLineEndings(input, 'auto', 'unix')
    assert.strictEqual(result.toString('utf8'), 'line1\nline2\nline3')
  })

  await t.test('convertLineEndings - auto mode uses platform default (windows)', () => {
    const input = Buffer.from('line1\nline2\nline3')
    const result = convertLineEndings(input, 'auto', 'windows')
    assert.strictEqual(result.toString('utf8'), 'line1\r\nline2\r\nline3')
  })

  await t.test('convertLineEndings - binary mode returns as-is', () => {
    const input = Buffer.from('binary\x00data\r\nwith\nmixed')
    const result = convertLineEndings(input, 'binary')
    assert.deepStrictEqual(result, input)
  })

  await t.test('convertLineEndings - empty eol returns as-is', () => {
    const input = Buffer.from('line1\nline2\nline3')
    const result = convertLineEndings(input, '')
    assert.deepStrictEqual(result, input)
  })

  await t.test('convertLineEndings - unknown eol returns as-is', () => {
    const input = Buffer.from('line1\nline2\nline3')
    const result = convertLineEndings(input, 'unknown')
    assert.deepStrictEqual(result, input)
  })

  await t.test('convertLineEndings - handles CR-only line endings', () => {
    const input = Buffer.from('line1\rline2\rline3')
    const result = convertLineEndings(input, 'lf')
    assert.strictEqual(result.toString('utf8'), 'line1\nline2\nline3')
  })

  await t.test('convertLineEndings - handles mixed line endings', () => {
    const input = Buffer.from('line1\r\nline2\nline3\rline4')
    const result = convertLineEndings(input, 'lf')
    assert.strictEqual(result.toString('utf8'), 'line1\nline2\nline3\nline4')
  })

  await t.test('convertLineEndings - handles Uint8Array input', () => {
    const input = new Uint8Array([108, 105, 110, 101, 49, 13, 10, 108, 105, 110, 101, 50]) // 'line1\r\nline2'
    const result = convertLineEndings(input, 'lf')
    assert.strictEqual(result.toString('utf8'), 'line1\nline2')
  })

  await t.test('convertLineEndings - handles empty buffer', () => {
    const input = Buffer.from('')
    const result = convertLineEndings(input, 'lf')
    assert.strictEqual(result.toString('utf8'), '')
  })

  await t.test('convertLineEndings - handles buffer with no line endings', () => {
    const input = Buffer.from('singleline')
    const result = convertLineEndings(input, 'lf')
    assert.strictEqual(result.toString('utf8'), 'singleline')
  })

  await t.test('normalizeToLF - converts all line endings to LF', () => {
    const input = Buffer.from('line1\r\nline2\rline3\nline4')
    const result = normalizeToLF(input)
    assert.strictEqual(result.toString('utf8'), 'line1\nline2\nline3\nline4')
  })

  await t.test('normalizeToLF - handles Uint8Array', () => {
    const input = new Uint8Array([108, 105, 110, 101, 49, 13, 10, 108, 105, 110, 101, 50])
    const result = normalizeToLF(input)
    assert.strictEqual(result.toString('utf8'), 'line1\nline2')
  })

  await t.test('convertForWorkdir - uses auto mode with platform default', () => {
    const input = Buffer.from('line1\nline2\nline3')
    const resultUnix = convertForWorkdir({ buffer: input, platform: 'unix' })
    assert.strictEqual(resultUnix.toString('utf8'), 'line1\nline2\nline3')
    
    const resultWindows = convertForWorkdir({ buffer: input, platform: 'windows' })
    assert.strictEqual(resultWindows.toString('utf8'), 'line1\r\nline2\r\nline3')
  })

  await t.test('convertForWorkdir - respects eol parameter', () => {
    const input = Buffer.from('line1\r\nline2\r\nline3')
    const result = convertForWorkdir({ buffer: input, eol: 'lf', platform: 'windows' })
    assert.strictEqual(result.toString('utf8'), 'line1\nline2\nline3')
  })

  await t.test('convertForWorkdir - defaults to unix platform', () => {
    const input = Buffer.from('line1\r\nline2\r\nline3')
    const result = convertForWorkdir({ buffer: input })
    assert.strictEqual(result.toString('utf8'), 'line1\nline2\nline3')
  })

  await t.test('convertForStorage - always normalizes to LF', () => {
    const input = Buffer.from('line1\r\nline2\rline3\nline4')
    const result = convertForStorage({ buffer: input, eol: 'crlf' })
    assert.strictEqual(result.toString('utf8'), 'line1\nline2\nline3\nline4')
  })

  await t.test('convertForStorage - ignores eol parameter (always LF)', () => {
    const input = Buffer.from('line1\r\nline2\r\nline3')
    const result1 = convertForStorage({ buffer: input, eol: 'crlf' })
    const result2 = convertForStorage({ buffer: input, eol: 'lf' })
    const result3 = convertForStorage({ buffer: input, eol: 'auto' })
    
    assert.strictEqual(result1.toString('utf8'), 'line1\nline2\nline3')
    assert.strictEqual(result2.toString('utf8'), 'line1\nline2\nline3')
    assert.strictEqual(result3.toString('utf8'), 'line1\nline2\nline3')
  })

  await t.test('convertLineEndings - handles unicode characters', () => {
    const input = Buffer.from('line1\n中文\r\nline2\n🚀\r\nline3')
    const result = convertLineEndings(input, 'lf')
    assert.strictEqual(result.toString('utf8'), 'line1\n中文\nline2\n🚀\nline3')
  })

  await t.test('convertLineEndings - handles multiline content', () => {
    const input = Buffer.from('line1\r\nline2\r\nline3\r\nline4\r\nline5')
    const result = convertLineEndings(input, 'lf')
    assert.strictEqual(result.toString('utf8'), 'line1\nline2\nline3\nline4\nline5')
  })
})

