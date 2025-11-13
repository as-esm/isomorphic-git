import { test } from 'node:test'
import assert from 'node:assert'
import { join } from '../../src/utils/join.ts'

test('join', async (t) => {
  await t.test('joins multiple path segments', () => {
    assert.strictEqual(join('foo', 'bar', 'baz'), 'foo/bar/baz')
    assert.strictEqual(join('/foo', 'bar', 'baz'), '/foo/bar/baz')
  })

  await t.test('handles empty arguments', () => {
    assert.strictEqual(join(), '.')
  })

  await t.test('handles single argument', () => {
    assert.strictEqual(join('foo'), 'foo')
    assert.strictEqual(join('/foo'), '/foo')
  })

  await t.test('normalizes path', () => {
    assert.strictEqual(join('foo', '..', 'bar'), 'bar')
    assert.strictEqual(join('foo', '.', 'bar'), 'foo/bar')
    assert.strictEqual(join('foo', 'bar', '..', 'baz'), 'foo/baz')
  })

  await t.test('handles empty segments', () => {
    assert.strictEqual(join('foo', '', 'bar'), 'foo/bar')
    assert.strictEqual(join('', 'foo', 'bar'), 'foo/bar')
  })

  await t.test('handles absolute paths', () => {
    assert.strictEqual(join('/foo', 'bar'), '/foo/bar')
    // join doesn't replace relative with absolute, it just joins
    assert.strictEqual(join('foo', '/bar'), 'foo/bar')
  })

  await t.test('handles trailing separators', () => {
    assert.strictEqual(join('foo/', 'bar'), 'foo/bar')
    // join preserves trailing separator if present
    assert.ok(join('foo', 'bar/').endsWith('/'))
  })
})

