import { test } from 'node:test'
import assert from 'node:assert'
import { mode2type } from '../../src/utils/mode2type.ts'
import { InternalError } from '../../src/errors/InternalError.ts'

test('mode2type', async (t) => {
  await t.test('returns tree for directory mode', () => {
    assert.strictEqual(mode2type(0o040000), 'tree')
  })

  await t.test('returns blob for regular file mode (644)', () => {
    assert.strictEqual(mode2type(0o100644), 'blob')
  })

  await t.test('returns blob for executable file mode (755)', () => {
    assert.strictEqual(mode2type(0o100755), 'blob')
  })

  await t.test('returns blob for symlink mode', () => {
    assert.strictEqual(mode2type(0o120000), 'blob')
  })

  await t.test('returns commit for gitlink mode', () => {
    assert.strictEqual(mode2type(0o160000), 'commit')
  })

  await t.test('throws InternalError for invalid mode', () => {
    assert.throws(() => {
      mode2type(0o123456)
    }, (err: Error) => {
      return err instanceof InternalError && err.message.includes('Unexpected GitTree entry mode')
    })
  })

  await t.test('throws InternalError for zero mode', () => {
    assert.throws(() => {
      mode2type(0)
    }, (err: Error) => {
      return err instanceof InternalError && err.message.includes('Unexpected GitTree entry mode')
    })
  })
})

