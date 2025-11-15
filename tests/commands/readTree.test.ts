import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Errors, readTree } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

describe('readTree', () => {
  it('read a tree directly', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readTree')
    // Test
    const { oid, tree } = await readTree({
      fs,
      gitdir,
      oid: '6257985e3378ec42a03a57a7dc8eb952d69a5ff3',
    })
    assert.strictEqual(oid, '6257985e3378ec42a03a57a7dc8eb952d69a5ff3')
    assert.ok(Array.isArray(tree))
    assert.ok(tree.length > 0)
    // Check that tree entries have required properties
    tree.forEach(entry => {
      assert.ok(entry.mode)
      assert.ok(entry.oid)
      assert.ok(entry.path)
      assert.ok(entry.type)
    })
  })
})

