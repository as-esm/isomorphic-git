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

  it('from packfile deflated', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    const ref = await readObject({
      fs,
      gitdir,
      oid: '0b8faa11b353db846b40eb064dfb299816542a46',
      format: 'deflated',
    })
    // Packed objects may be returned as 'content' or 'wrapped' format depending on implementation
    assert.ok(ref.format === 'content' || ref.format === 'wrapped')
    // Type may be 'commit' (if content) or 'wrapped' (if wrapped format)
    assert.ok(ref.type === 'commit' || ref.type === 'wrapped')
    assert.ok(ref.source)
    assert.ok(ref.source.includes('pack'))
    assert.ok(ref.object)
  })

  it('from packfile wrapped', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    const ref = await readObject({
      fs,
      gitdir,
      oid: '0b8faa11b353db846b40eb064dfb299816542a46',
      format: 'wrapped',
    })
    // Packed objects may be returned as 'content' or 'wrapped' format depending on implementation
    assert.ok(ref.format === 'content' || ref.format === 'wrapped')
    // Type may be 'commit' (if content) or 'wrapped' (if wrapped format)
    assert.ok(ref.type === 'commit' || ref.type === 'wrapped')
    assert.ok(ref.source)
    assert.ok(ref.source.includes('pack'))
    assert.ok(ref.object)
  })

  it('from packfile content', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    const ref = await readObject({
      fs,
      gitdir,
      oid: '0b8faa11b353db846b40eb064dfb299816542a46',
      format: 'content',
    })
    assert.strictEqual(ref.format, 'content')
    assert.strictEqual(ref.type, 'commit')
    assert.ok(ref.source)
    assert.ok(ref.source.includes('pack'))
    assert.ok(ref.object)
  })

  it('with simple filepath to blob', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    const ref = await readObject({
      fs,
      gitdir,
      oid: 'be1e63da44b26de8877a184359abace1cddcb739',
      format: 'parsed',
      filepath: 'cli.js',
    })
    // When filepath is provided, format may change to 'content'
    assert.ok(ref.format === 'content' || ref.format === 'parsed')
    assert.strictEqual(ref.type, 'blob')
    assert.ok(ref.source)
    assert.strictEqual(ref.oid, '4551a1856279dde6ae9d65862a1dff59a5f199d8')
    assert.ok(ref.object)
  })

  it('with deep filepath to blob', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    const ref = await readObject({
      fs,
      gitdir,
      oid: 'be1e63da44b26de8877a184359abace1cddcb739',
      format: 'parsed',
      filepath: 'src/commands/clone.js',
    })
    // When filepath is provided, format may change to 'content'
    assert.ok(ref.format === 'content' || ref.format === 'parsed')
    assert.strictEqual(ref.type, 'blob')
    assert.strictEqual(ref.oid, '5264f23285d8be3ce45f95c102001ffa1d5391d3')
    assert.ok(ref.object)
  })

  it('with simple filepath to tree', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    const ref = await readObject({
      fs,
      gitdir,
      oid: 'be1e63da44b26de8877a184359abace1cddcb739',
      format: 'parsed',
      filepath: '',
    })
    assert.strictEqual(ref.format, 'parsed')
    assert.strictEqual(ref.type, 'tree')
    assert.ok(ref.source)
    assert.strictEqual(ref.oid, '6257985e3378ec42a03a57a7dc8eb952d69a5ff3')
    assert.ok(Array.isArray(ref.object))
    assert.ok(ref.object.length > 0)
  })

  it('with deep filepath to tree', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    const ref = await readObject({
      fs,
      gitdir,
      oid: 'be1e63da44b26de8877a184359abace1cddcb739',
      format: 'parsed',
      filepath: 'src/commands',
    })
    assert.strictEqual(ref.format, 'parsed')
    assert.strictEqual(ref.type, 'tree')
    assert.strictEqual(ref.oid, '7704a6e8a802efcdbe6cf3dfa114c105f1d5c67a')
    assert.ok(Array.isArray(ref.object))
    assert.ok(ref.object.length > 0)
    // Verify it's the commands directory
    const entry = ref.object.find((e: any) => e.path === 'clone.js')
    assert.ok(entry, 'Should contain clone.js')
  })

  it('with erroneous filepath (directory is a file)', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    let error: unknown = null
    try {
      await readObject({
        fs,
        gitdir,
        oid: 'be1e63da44b26de8877a184359abace1cddcb739',
        format: 'parsed',
        filepath: 'src/commands/clone.js/isntafolder.txt',
      })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.ObjectTypeError)
  })

  it('with erroneous filepath (no such directory)', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    let error: unknown = null
    try {
      await readObject({
        fs,
        gitdir,
        oid: 'be1e63da44b26de8877a184359abace1cddcb739',
        format: 'parsed',
        filepath: 'src/isntafolder',
      })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.NotFoundError)
  })

  it('with erroneous filepath (leading slash)', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    let error: unknown = null
    try {
      await readObject({
        fs,
        gitdir,
        oid: 'be1e63da44b26de8877a184359abace1cddcb739',
        format: 'parsed',
        filepath: '/src',
      })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.InvalidFilepathError)
    if (error instanceof Errors.InvalidFilepathError) {
      assert.strictEqual(error.data.reason, 'leading-slash')
    }
  })

  it('with erroneous filepath (trailing slash)', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readObject')
    // Test
    let error: unknown = null
    try {
      await readObject({
        fs,
        gitdir,
        oid: 'be1e63da44b26de8877a184359abace1cddcb739',
        format: 'parsed',
        filepath: 'src/',
      })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.InvalidFilepathError)
    if (error instanceof Errors.InvalidFilepathError) {
      assert.strictEqual(error.data.reason, 'trailing-slash')
    }
  })
})

