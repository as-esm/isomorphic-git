import { test } from 'node:test'
import assert from 'node:assert'
import { dirname } from '../../src/utils/dirname.ts'

test('dirname', async (t) => {
  await t.test('returns parent directory for Unix path', () => {
    assert.strictEqual(dirname('/foo/bar/baz'), '/foo/bar')
    assert.strictEqual(dirname('/foo/bar'), '/foo')
    assert.strictEqual(dirname('/foo'), '/')
  })

  await t.test('returns parent directory for Windows path', () => {
    assert.strictEqual(dirname('C:\\foo\\bar\\baz'), 'C:\\foo\\bar')
    assert.strictEqual(dirname('C:\\foo\\bar'), 'C:\\foo')
    assert.strictEqual(dirname('C:\\foo'), 'C:')
  })

  await t.test('handles relative paths', () => {
    assert.strictEqual(dirname('foo/bar/baz'), 'foo/bar')
    assert.strictEqual(dirname('foo/bar'), 'foo')
    assert.strictEqual(dirname('foo'), '.')
  })

  await t.test('handles root paths', () => {
    assert.strictEqual(dirname('/'), '/')
    assert.strictEqual(dirname('C:\\'), 'C:')
  })

  await t.test('handles single component paths', () => {
    assert.strictEqual(dirname('file.txt'), '.')
    assert.strictEqual(dirname(''), '.')
  })

  await t.test('handles mixed separators', () => {
    assert.strictEqual(dirname('foo/bar\\baz'), 'foo/bar')
    assert.strictEqual(dirname('foo\\bar/baz'), 'foo\\bar')
  })
})

