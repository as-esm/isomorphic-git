import { test } from 'node:test'
import assert from 'node:assert'
import { indent } from '../../src/utils/indent.ts'

test('indent', async (t) => {
  await t.test('adds leading space to each line', () => {
    const input = 'line1\nline2\nline3'
    const result = indent(input)
    assert.strictEqual(result, ' line1\n line2\n line3\n')
  })

  await t.test('trims input before indenting', () => {
    const input = '  line1  \n  line2  '
    const result = indent(input)
    // trim() only removes leading/trailing whitespace from entire string, not per line
    // So '  line1  \n  line2  '.trim() = 'line1  \n  line2'
    // Then split gives ['line1  ', '  line2'], map adds space: [' line1  ', '   line2']
    assert.strictEqual(result, ' line1  \n   line2\n')
  })

  await t.test('adds newline at end', () => {
    const input = 'line1\nline2'
    const result = indent(input)
    assert.ok(result.endsWith('\n'))
  })

  await t.test('handles single line', () => {
    const result = indent('line')
    assert.strictEqual(result, ' line\n')
  })

  await t.test('handles empty string', () => {
    const result = indent('')
    // After trim, empty string becomes '', split gives [''], map adds space to get [' '], join gives ' ', then add '\n'
    assert.strictEqual(result, ' \n')
  })

  await t.test('handles whitespace-only string', () => {
    const result = indent('   \n  \n  ')
    // After trim, whitespace-only becomes '', same as empty string
    assert.strictEqual(result, ' \n')
  })

  await t.test('handles already indented lines', () => {
    const input = ' line1\n line2'
    const result = indent(input)
    // trim() removes leading/trailing whitespace, so " line1\n line2" becomes "line1\n line2"
    // then each line gets a space prepended: " line1\n  line2"
    assert.strictEqual(result, ' line1\n  line2\n')
  })

  await t.test('preserves content while adding indentation', () => {
    const input = 'test\ncontent\nhere'
    const result = indent(input)
    assert.ok(result.includes('test'))
    assert.ok(result.includes('content'))
    assert.ok(result.includes('here'))
    assert.strictEqual(result.split('\n').length, 4) // 3 lines + trailing newline
  })
})

