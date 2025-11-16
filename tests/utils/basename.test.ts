import { test } from 'node:test'
import assert from 'node:assert'
import { basename } from '../../src/utils/basename.ts'

test('basename', async (t) => {
  await t.test('extracts filename from Unix path', () => {
    assert.strictEqual(basename('/path/to/file.txt'), 'file.txt')
  })

  await t.test('extracts filename from Windows path', () => {
    assert.strictEqual(basename('C:\\path\\to\\file.txt'), 'file.txt')
  })

  await t.test('handles path with only filename', () => {
    assert.strictEqual(basename('file.txt'), 'file.txt')
  })

  await t.test('handles path ending with separator', () => {
    assert.strictEqual(basename('/path/to/'), '')
    assert.strictEqual(basename('C:\\path\\to\\'), '')
  })

  await t.test('prefers backslash over forward slash on Windows-style paths', () => {
    // If path has both, it uses the last one
    assert.strictEqual(basename('/path\\to/file.txt'), 'file.txt')
    assert.strictEqual(basename('C:\\path/to\\file.txt'), 'file.txt')
  })

  await t.test('handles root path', () => {
    assert.strictEqual(basename('/'), '')
    assert.strictEqual(basename('\\'), '')
  })

  await t.test('handles empty string', () => {
    assert.strictEqual(basename(''), '')
  })

  await t.test('handles path with no separators', () => {
    assert.strictEqual(basename('filename'), 'filename')
  })

  await t.test('handles nested paths', () => {
    assert.strictEqual(basename('a/b/c/d/e.txt'), 'e.txt')
    assert.strictEqual(basename('a\\b\\c\\d\\e.txt'), 'e.txt')
  })
})

