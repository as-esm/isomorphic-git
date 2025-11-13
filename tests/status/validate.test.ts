import { test } from 'node:test'
import assert from 'node:assert'
import * as path from 'path'
import { Errors, status, add } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

test('invalid .git/index', async (t) => {
  await t.test('empty file', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-empty')
    const file = 'a.txt'

    await fs.write(path.join(dir, file), 'Hi', 'utf8')
    await add({ fs, dir, filepath: file })
    await fs.write(path.join(dir, '.git', 'index'), '', 'utf8')

    // Test
    let error: unknown = null
    try {
      await status({ fs, dir, filepath: file })
    } catch (e) {
      error = e
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.InternalError)
    assert.strictEqual((error as any).data.message, 'Index file is empty (.git/index)')
  })

  await t.test('no magic number', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-empty')
    const file = 'a.txt'

    await fs.write(path.join(dir, file), 'Hi', 'utf8')
    await add({ fs, dir, filepath: file })
    await fs.write(path.join(dir, '.git', 'index'), 'no-magic-number', 'utf8')

    // Test
    let error: unknown = null
    try {
      await status({ fs, dir, filepath: file })
    } catch (e) {
      error = e
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.InternalError)
    assert.ok((error as any).data.message.includes('Invalid dircache magic file number'))
  })

  await t.test('wrong checksum', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-empty')
    const file = 'a.txt'

    await fs.write(path.join(dir, file), 'Hi', 'utf8')
    await add({ fs, dir, filepath: file })
    await fs.write(path.join(dir, '.git', 'index'), 'DIRCxxxxx', 'utf8')

    // Test
    let error: unknown = null
    try {
      await status({ fs, dir, filepath: file })
    } catch (e) {
      error = e
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.InternalError)
    assert.ok((error as any).data.message.includes('Invalid checksum in GitIndex buffer'))
  })
})

