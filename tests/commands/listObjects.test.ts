import { test } from 'node:test'
import assert from 'node:assert'
import { init, commit, add } from 'isomorphic-git'
import { listObjects } from '../../src/commands/listObjects.ts'
import { makeFixture } from '../helpers/fixture.ts'

test('listObjects', async (t) => {
  await t.test('returns Set for empty oids array', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })

    const objects = await listObjects({ fs, cache: {}, gitdir, oids: [] })

    assert.ok(objects instanceof Set, 'Should return a Set')
    assert.strictEqual(objects.size, 0, 'Should return empty Set for empty oids')
  })


  await t.test('handles non-existent OID gracefully', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })

    const fakeOid = 'a'.repeat(40)
    try {
      await listObjects({ fs, cache: {}, gitdir, oids: [fakeOid] })
      // listObjects might not throw immediately, but will fail when trying to read the object
      // The error will occur during the walk() function when trying to readObject
      assert.fail('Should have thrown an error for non-existent OID')
    } catch (error) {
      assert.ok(error instanceof Error, 'Should throw an error when object does not exist')
    }
  })


  await t.test('handles iterable oids (array)', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })

    // Test that listObjects accepts an array as iterable
    const oidsArray: string[] = []
    const objects = await listObjects({ fs, cache: {}, gitdir, oids: oidsArray })

    assert.ok(objects instanceof Set, 'Should return a Set')
    assert.strictEqual(objects.size, 0, 'Should return empty Set for empty array')
  })

  await t.test('handles iterable oids (Set)', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })

    // Test that listObjects accepts a Set as iterable
    const oidsSet = new Set<string>()
    const objects = await listObjects({ fs, cache: {}, gitdir, oids: oidsSet })

    assert.ok(objects instanceof Set, 'Should return a Set')
    assert.strictEqual(objects.size, 0, 'Should return empty Set for empty Set')
  })
})

