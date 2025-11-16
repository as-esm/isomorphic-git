import { test } from 'node:test'
import assert from 'node:assert'
import { outdent } from '../../src/utils/outdent.ts'

test('outdent', async (t) => {
  await t.test('removes single leading space from each line', () => {
    const result = outdent(' line1\n line2\n line3')
    assert.strictEqual(result, 'line1\nline2\nline3')
  })

  await t.test('handles lines without leading space', () => {
    const result = outdent('line1\n line2\nline3')
    assert.strictEqual(result, 'line1\nline2\nline3')
  })

  await t.test('handles empty string', () => {
    const result = outdent('')
    assert.strictEqual(result, '')
  })

  await t.test('handles string with only spaces', () => {
    const result = outdent(' \n \n ')
    assert.strictEqual(result, '\n\n')
  })

  await t.test('removes only first space from each line', () => {
    const result = outdent('  line1\n  line2')
    assert.strictEqual(result, ' line1\n line2')
  })

  await t.test('handles single line', () => {
    const result = outdent(' hello')
    assert.strictEqual(result, 'hello')
  })

  await t.test('handles lines with tabs or other whitespace', () => {
    const result = outdent(' line1\n\tline2\n line3')
    assert.strictEqual(result, 'line1\n\tline2\nline3')
  })
})
