import { test } from 'node:test'
import assert from 'node:assert'
import { Errors } from 'isomorphic-git'
const { InvalidOidError } = Errors

test('InvalidOidError', async (t) => {
  await t.test('creates error with correct message and code', () => {
    const error = new InvalidOidError('abc123')
    
    assert.strictEqual(error.code, 'InvalidOidError')
    assert.strictEqual(error.name, 'InvalidOidError')
    assert.ok(error.message.includes('abc123'))
    assert.ok(error.message.includes('40-char hex object id'))
    assert.deepStrictEqual(error.data, { value: 'abc123' })
  })

  await t.test('extends BaseError', () => {
    const error = new InvalidOidError('invalid')
    
    assert.ok(error instanceof Error)
  })
})

