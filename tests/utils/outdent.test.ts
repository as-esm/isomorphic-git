import { test } from 'node:test'
import assert from 'node:assert'
import { outdent } from '../../src/utils/outdent.ts'

test('outdent', async (t) => {
  await t.test('removes leading space from each line', () => {
    const input = ' line1\n line2\n line3'
    const result = outdent(input)
    assert.strictEqual(result, 'line1\nline2\nline3')
  })

  await t.test('only removes single leading space', () => {
    const input = '  line1\n  line2'
    const result = outdent(input)
    assert.strictEqual(result, ' line1\n line2')
  })

  await t.test('handles lines without leading space', () => {
    const input = 'line1\n line2\nline3'
    const result = outdent(input)
    assert.strictEqual(result, 'line1\nline2\nline3')
  })

  await t.test('handles empty string', () => {
    const result = outdent('')
    assert.strictEqual(result, '')
  })

  await t.test('handles single line', () => {
    const result = outdent(' line')
    assert.strictEqual(result, 'line')
  })

  await t.test('handles lines with no spaces', () => {
    const input = 'line1\nline2\nline3'
    const result = outdent(input)
    assert.strictEqual(result, 'line1\nline2\nline3')
  })

  await t.test('handles mixed indentation', () => {
    const input = 'line1\n line2\n  line3'
    const result = outdent(input)
    assert.strictEqual(result, 'line1\nline2\n line3')
  })
})

