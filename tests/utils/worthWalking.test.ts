import { test } from 'node:test'
import assert from 'node:assert'
import { worthWalking } from '../../src/utils/worthWalking.ts'

test('worthWalking', async (t) => {
  await t.test('returns true for current directory', () => {
    assert.strictEqual(worthWalking('.', 'any'), true)
    assert.strictEqual(worthWalking('.', null), true)
    assert.strictEqual(worthWalking('.', undefined), true)
  })

  await t.test('returns true when root is null', () => {
    assert.strictEqual(worthWalking('path/to/file', null), true)
  })

  await t.test('returns true when root is undefined', () => {
    assert.strictEqual(worthWalking('path/to/file', undefined), true)
  })

  await t.test('returns true when root is empty string', () => {
    assert.strictEqual(worthWalking('path/to/file', ''), true)
  })

  await t.test('returns true when root is current directory', () => {
    assert.strictEqual(worthWalking('path/to/file', '.'), true)
  })

  await t.test('returns true when filepath starts with root', () => {
    assert.strictEqual(worthWalking('path/to/file', 'path'), true)
    assert.strictEqual(worthWalking('path/to/file', 'path/to'), true)
  })

  await t.test('returns true when root starts with filepath', () => {
    assert.strictEqual(worthWalking('path', 'path/to/file'), true)
    assert.strictEqual(worthWalking('path/to', 'path/to/file'), true)
  })

  await t.test('returns false when paths are unrelated', () => {
    assert.strictEqual(worthWalking('path/to/file', 'other'), false)
    assert.strictEqual(worthWalking('path/to/file', 'path/other'), false)
  })

  await t.test('handles exact match', () => {
    assert.strictEqual(worthWalking('path/to/file', 'path/to/file'), true)
  })

  await t.test('handles root longer than filepath', () => {
    assert.strictEqual(worthWalking('path', 'path/to/deep/nested'), true)
    assert.strictEqual(worthWalking('path', 'other/path'), false)
  })

  await t.test('handles filepath longer than root', () => {
    assert.strictEqual(worthWalking('path/to/deep/nested', 'path'), true)
    assert.strictEqual(worthWalking('other/path/to/file', 'path'), false)
  })
})

