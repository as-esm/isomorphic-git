import { test } from 'node:test'
import assert from 'node:assert'
import { readNote } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

test('readNote', async (t) => {
  await t.test('to a commit', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readNote')
    // Test
    const note = await readNote({
      fs,
      gitdir,
      oid: 'f6d51b1f9a449079f6999be1fb249c359511f164',
    })
    assert.strictEqual(
      Buffer.from(note).toString('utf8'),
      'This is a note about a commit.\n'
    )
  })

  await t.test('to a tree', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readNote')
    // Test
    const note = await readNote({
      fs,
      gitdir,
      oid: '199948939a0b95c6f27668689102496574b2c332',
    })
    assert.strictEqual(
      Buffer.from(note).toString('utf8'),
      'This is a note about a tree.\n'
    )
  })

  await t.test('to a blob', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readNote')
    // Test
    const note = await readNote({
      fs,
      gitdir,
      oid: '68aba62e560c0ebc3396e8ae9335232cd93a3f60',
    })
    assert.strictEqual(
      Buffer.from(note).toString('utf8'),
      'This is a note about a blob.\n'
    )
  })

  await t.test('from an alternate branch', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-readNote')
    // Test
    const note = await readNote({
      fs,
      gitdir,
      ref: 'refs/notes/alt',
      oid: 'f6d51b1f9a449079f6999be1fb249c359511f164',
    })
    assert.strictEqual(
      Buffer.from(note).toString('utf8'),
      'This is alternate note about a commit.\n'
    )
  })
})

