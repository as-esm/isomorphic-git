import { test } from 'node:test'
import assert from 'node:assert'
import { Errors } from 'isomorphic-git'

test('Errors', async (t) => {
  await t.test('have the correct value for their static property code', async () => {
    for (const [name, Value] of Object.entries(Errors)) {
      if (typeof Value === 'function' && 'code' in Value) {
        // @ts-expect-error - accessing code property
        assert.strictEqual(name, Value.code, `Error ${name} should have code matching its name`)
      }
    }
  })

  await t.test('create a NotFoundError', async () => {
    let e: unknown = null
    try {
      throw new Errors.NotFoundError('foobar.txt')
    } catch (err) {
      e = err
    }
    
    assert.notStrictEqual(e, null, 'Error should be thrown')
    assert.ok(e instanceof Error, 'Error should be an instance of Error')
    assert.ok(e instanceof Errors.NotFoundError, 'Error should be an instance of NotFoundError')
    
    if (e instanceof Errors.NotFoundError) {
      assert.strictEqual(e.code, 'NotFoundError', 'Error code should be NotFoundError')
      
      const json = e.toJSON()
      // Remove stack trace for comparison (it's environment-dependent)
      delete (json as any).stack
      
      assert.deepStrictEqual(json, {
        caller: '',
        code: 'NotFoundError',
        data: {
          what: 'foobar.txt',
        },
        message: 'Could not find foobar.txt.',
      })
    }
  })
})

