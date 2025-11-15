import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Errors, readObject } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

describe('readObject', () => {
  it('test missing', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    let error = null
    try {
      await readObject({
        fs,
        gitdir,
        oid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.NotFoundError)
  })
  
  it('parsed', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    const ref = await readObject({
      fs,
      gitdir,
      oid: 'e10ebb90d03eaacca84de1af0a59b444232da99e',
    })
    assert.strictEqual(ref.format, 'parsed')
    assert.strictEqual(ref.type, 'commit')
    assert.strictEqual(ref.oid, 'e10ebb90d03eaacca84de1af0a59b444232da99e')
    assert.ok(ref.object)
    assert.ok(ref.object.author)
    assert.ok(ref.object.committer)
    assert.ok(ref.object.message)
  })
  
  it('content', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    const ref = await readObject({
      fs,
      gitdir,
      oid: 'e10ebb90d03eaacca84de1af0a59b444232da99e',
      format: 'content',
    })
    assert.strictEqual(ref.format, 'content')
    assert.strictEqual(ref.type, 'commit')
    assert.ok(ref.source)
    assert.ok(ref.object)
  })
  
  it('wrapped', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    const ref = await readObject({
      fs,
      gitdir,
      oid: 'e10ebb90d03eaacca84de1af0a59b444232da99e',
      format: 'wrapped',
    })
    assert.strictEqual(ref.format, 'wrapped')
    assert.strictEqual(ref.type, 'wrapped')
    assert.ok(ref.source)
    assert.ok(ref.object)
  })
  
  it('deflated', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    const ref = await readObject({
      fs,
      gitdir,
      oid: 'e10ebb90d03eaacca84de1af0a59b444232da99e',
      format: 'deflated',
    })
    assert.strictEqual(ref.format, 'deflated')
    assert.strictEqual(ref.type, 'deflated')
    assert.ok(ref.source)
    assert.ok(ref.object)
  })
  
  it('blob with encoding', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    const ref = await readObject({
      fs,
      gitdir,
      oid: '4551a1856279dde6ae9d65862a1dff59a5f199d8',
      format: 'parsed',
      encoding: 'utf8',
    })
    assert.strictEqual(ref.format, 'parsed')
    assert.strictEqual(ref.type, 'blob')
    assert.ok(ref.object)
    assert.ok(typeof ref.object === 'string')
  })
})

