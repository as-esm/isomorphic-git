import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Errors, readCommit } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

describe('readCommit', () => {
  it('test missing', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readCommit')
    // Test
    let error = null
    try {
      await readCommit({
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
    const { fs, gitdir } = await makeFixture('test-readCommit')
    // Test
    const result = await readCommit({
      fs,
      gitdir,
      oid: 'e10ebb90d03eaacca84de1af0a59b444232da99e',
    })
    assert.strictEqual(result.oid, 'e10ebb90d03eaacca84de1af0a59b444232da99e')
    assert.ok(result.commit)
    assert.strictEqual(result.commit.author.name, 'Will Hilton')
    assert.strictEqual(result.commit.author.email, 'wmhilton@gmail.com')
    assert.ok(result.commit.message)
    assert.ok(Array.isArray(result.commit.parent))
    assert.ok(result.commit.tree)
  })
  
  it('from packfile', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readCommit')
    // Test
    const result = await readCommit({
      fs,
      gitdir,
      oid: '0b8faa11b353db846b40eb064dfb299816542a46',
    })
    assert.strictEqual(result.oid, '0b8faa11b353db846b40eb064dfb299816542a46')
    assert.ok(result.commit)
    assert.strictEqual(result.commit.author.name, 'William Hilton')
    assert.ok(result.commit.message)
  })
  
  it('peels tags', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readCommit')
    // Test
    const result = await readCommit({
      fs,
      gitdir,
      oid: '587d3f8290b513e2ee85ecd317e6efecd545aee6',
    })
    assert.strictEqual(result.oid, '033417ae18b174f078f2f44232cb7a374f4c60ce')
  })
})

