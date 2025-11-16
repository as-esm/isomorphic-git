import { test } from 'node:test'
import assert from 'node:assert'
import { indent } from '../../src/utils/indent.ts'

test('indent', async (t) => {
  await t.test('indents single line', () => {
    const result = indent('hello')
    assert.strictEqual(result, ' hello\n')
  })

  await t.test('indents multiple lines', () => {
    const result = indent('line1\nline2\nline3')
    assert.strictEqual(result, ' line1\n line2\n line3\n')
  })

  await t.test('trims leading and trailing whitespace', () => {
    const result = indent('  hello  ')
    assert.strictEqual(result, ' hello\n')
  })

  await t.test('handles empty string', () => {
    const result = indent('')
    // trim() on empty string returns '', then ' ' + '' = ' ', then + '\n' = ' \n'
    assert.strictEqual(result, ' \n')
  })

  await t.test('handles string with only whitespace', () => {
    const result = indent('   \n  \n  ')
    // trim() removes all whitespace, leaving '', then ' ' + '' = ' ', then + '\n' = ' \n'
    assert.strictEqual(result, ' \n')
  })

  await t.test('preserves internal whitespace', () => {
    const result = indent('hello  world')
    assert.strictEqual(result, ' hello  world\n')
  })

  await t.test('handles multiline with varying indentation', () => {
    const result = indent('  line1\n    line2\n  line3')
    // trim() only removes leading/trailing whitespace from entire string, not per line
    // So '  line1\n    line2\n  line3' becomes 'line1\n    line2\nline3' after trim
    // Then each line gets ' ' prepended: ' line1\n     line2\n   line3\n'
    // Note: line3 has 2 spaces because '  line3' after trim becomes 'line3', but the original had 2 spaces
    assert.strictEqual(result, ' line1\n     line2\n   line3\n')
  })
})
