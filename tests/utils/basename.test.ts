import { test } from 'node:test'
import assert from 'node:assert'
import { basename } from '../../src/utils/basename.ts'

test('basename', async (t) => {
  await t.test('extracts basename from path', () => {
    assert.strictEqual(basename('path/to/file.txt'), 'file.txt')
  })

  await t.test('handles root file', () => {
    assert.strictEqual(basename('file.txt'), 'file.txt')
  })

  await t.test('handles path with trailing slash', () => {
    // When path ends with '/', basename returns empty string (the part after last '/')
    assert.strictEqual(basename('path/to/file.txt/'), '')
  })

  await t.test('handles path with only slashes', () => {
    assert.strictEqual(basename('///'), '')
  })

  await t.test('handles empty string', () => {
    assert.strictEqual(basename(''), '')
  })

  await t.test('handles single directory', () => {
    assert.strictEqual(basename('dir'), 'dir')
  })

  await t.test('handles nested paths', () => {
    assert.strictEqual(basename('a/b/c/d.txt'), 'd.txt')
  })
})
