import { test } from 'node:test'
import assert from 'node:assert'
import { resetIndex, listFiles, statusMatrix } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

test('resetIndex', async (t) => {
  await t.test('modified', async () => {
    // Setup
    const { fs, gitdir, dir } = await makeFixture('test-resetIndex')
    // Test
    const before = await listFiles({ fs, gitdir })
    assert.ok(Array.isArray(before))
    assert.ok(before.includes('a.txt'))
    assert.ok(before.includes('b.txt'))
    assert.ok(before.includes('d.txt'))
    await resetIndex({ fs, dir, gitdir, filepath: 'a.txt' })
    const after = await listFiles({ fs, gitdir })
    assert.ok(Array.isArray(after))
    assert.ok(after.includes('a.txt'))
    assert.ok(after.includes('b.txt'))
    assert.ok(after.includes('d.txt'))
    assert.strictEqual(before.length, after.length)
  })

  await t.test('new file', async () => {
    // Setup
    const { fs, gitdir, dir } = await makeFixture('test-resetIndex')
    // Test
    const before = await listFiles({ fs, gitdir })
    assert.ok(Array.isArray(before))
    assert.ok(before.includes('a.txt'))
    assert.ok(before.includes('b.txt'))
    assert.ok(before.includes('d.txt'))
    await resetIndex({ fs, dir, gitdir, filepath: 'd.txt' })
    const after = await listFiles({ fs, gitdir })
    assert.ok(Array.isArray(after))
    assert.ok(after.includes('a.txt'))
    assert.ok(after.includes('b.txt'))
    assert.ok(!after.includes('d.txt'))
    assert.strictEqual(before.length, after.length + 1)
  })

  await t.test('new repository', async () => {
    // Setup
    const { fs, gitdir, dir } = await makeFixture('test-resetIndex-new')
    // Test
    const before = await listFiles({ fs, gitdir })
    assert.ok(Array.isArray(before))
    assert.ok(before.includes('a.txt'))
    assert.ok(before.includes('b.txt'))
    await resetIndex({ fs, dir, gitdir, filepath: 'b.txt' })
    const after = await listFiles({ fs, gitdir })
    assert.ok(Array.isArray(after))
    assert.ok(after.includes('a.txt'))
    assert.ok(!after.includes('b.txt'))
    assert.strictEqual(before.length, after.length + 1)
  })

  await t.test('oid', async () => {
    // Setup
    const { fs, gitdir, dir } = await makeFixture('test-resetIndex-oid')
    // Test
    const before = await statusMatrix({ fs, dir, gitdir })
    assert.ok(Array.isArray(before))
    // Find b.txt in the status matrix
    const bBefore = before.find((entry: any) => entry[0] === 'b.txt')
    assert.ok(bBefore, 'b.txt should be in status matrix')
    // Status matrix format: [filepath, HEAD, INDEX, WORKDIR]
    // All should be 1 (present) before reset
    assert.strictEqual(bBefore[1], 1) // HEAD
    assert.strictEqual(bBefore[2], 1) // INDEX
    assert.strictEqual(bBefore[3], 1) // WORKDIR
    await resetIndex({
      fs,
      dir,
      gitdir,
      filepath: 'b.txt',
      ref: '572d5ec8ea719ed6780ef0e6a115a75999cb3091',
    })
    const after = await statusMatrix({ fs, dir, gitdir })
    assert.ok(Array.isArray(after))
    // Find b.txt in the status matrix after reset
    const bAfter = after.find((entry: any) => entry[0] === 'b.txt')
    assert.ok(bAfter, 'b.txt should still be in status matrix')
    // After reset to specific OID, WORKDIR should be 0 (absent)
    assert.strictEqual(bAfter[1], 1) // HEAD
    assert.strictEqual(bAfter[2], 1) // INDEX
    assert.strictEqual(bAfter[3], 0) // WORKDIR (absent after reset)
  })
})

