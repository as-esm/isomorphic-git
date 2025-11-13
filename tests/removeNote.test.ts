import { test } from 'node:test'
import assert from 'node:assert'
import { listNotes, removeNote } from 'isomorphic-git'
import { makeFixture } from './helpers/fixture.ts'

test('removeNote', async (t) => {
  await t.test('from default branch', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-removeNote')
    // Test
    let notes = await listNotes({
      fs,
      gitdir,
    })
    assert.strictEqual(notes.length, 3)
    const oid = await removeNote({
      fs,
      gitdir,
      author: {
        name: 'William Hilton',
        email: 'wmhilton@gmail.com',
        timestamp: 1578937310,
        timezoneOffset: 300,
      },
      oid: '199948939a0b95c6f27668689102496574b2c332',
    })
    notes = await listNotes({
      fs,
      gitdir,
    })
    assert.strictEqual(notes.length, 2)
    assert.strictEqual(oid, '96cc0598c9f2eaac733d0817981039596c0c410f')
  })

  await t.test('from alternate branch', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-removeNote')
    // Test
    let notes = await listNotes({
      fs,
      gitdir,
      ref: 'refs/notes/alt',
    })
    assert.strictEqual(notes.length, 1)
    const oid = await removeNote({
      fs,
      gitdir,
      author: {
        name: 'William Hilton',
        email: 'wmhilton@gmail.com',
        timestamp: 1578937310,
        timezoneOffset: 300,
      },
      ref: 'refs/notes/alt',
      oid: 'f6d51b1f9a449079f6999be1fb249c359511f164',
    })
    notes = await listNotes({
      fs,
      gitdir,
      ref: 'refs/notes/alt',
    })
    assert.strictEqual(notes.length, 0)
    assert.strictEqual(oid, 'cfab6e154843d83173626d8d39d1dbe0f603921b')
  })
})

