import { test } from 'node:test'
import assert from 'node:assert'
import { assertParameter } from '../../src/utils/assertParameter.ts'
import { MissingParameterError } from '../../src/errors/MissingParameterError.ts'

test('assertParameter', async (t) => {
  await t.test('does not throw for valid values', () => {
    assert.doesNotThrow(() => {
      assertParameter('test', 'value')
      assertParameter('test', 123)
      assertParameter('test', true)
      assertParameter('test', {})
      assertParameter('test', [])
      assertParameter('test', 0)
      assertParameter('test', false)
      assertParameter('test', '')
    })
  })

  await t.test('throws MissingParameterError for undefined', () => {
    assert.throws(() => {
      assertParameter('test', undefined)
    }, MissingParameterError)
  })

  await t.test('does not throw for null (null is a valid value)', () => {
    // Note: assertParameter only checks for undefined, not null
    assert.doesNotThrow(() => {
      assertParameter('test', null)
    })
  })
})

