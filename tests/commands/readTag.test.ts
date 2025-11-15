import { describe, it } from 'node:test'
import assert from 'node:assert'
import { readTag } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

describe('readTag', () => {
  it('annotated tag', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readTag')
    // Test
    const tag = await readTag({
      fs,
      gitdir,
      oid: '587d3f8290b513e2ee85ecd317e6efecd545aee6',
    })
    assert.strictEqual(tag.oid, '587d3f8290b513e2ee85ecd317e6efecd545aee6')
    assert.ok(tag.tag)
    assert.strictEqual(tag.tag.tag, 'mytag')
    assert.strictEqual(tag.tag.object, '033417ae18b174f078f2f44232cb7a374f4c60ce')
    assert.strictEqual(tag.tag.type, 'commit')
    assert.strictEqual(tag.tag.tagger.name, 'William Hilton')
    assert.strictEqual(tag.tag.tagger.email, 'wmhilton@gmail.com')
    assert.ok(tag.tag.message)
  })
})

