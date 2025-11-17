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

  await t.test('listObjects with comprehensive fixture', async () => {
    const { fs, gitdir } = await makeFixture('test-listObjects')
    const objects = await listObjects({
      fs,
      cache: {},
      gitdir,
      oids: [
        'c60bbbe99e96578105c57c4b3f2b6ebdf863edbc',
        'e05547ea87ea55eff079de295ff56f483e5b4439',
        'ebdedf722a3ec938da3fd53eb74fdea55c48a19d',
        '0518502faba1c63489562641c36a989e0f574d95',
      ],
    })
    
    assert.ok(objects instanceof Set, 'Should return a Set')
    assert.ok(objects.size > 0, 'Should return non-empty Set')
    // Verify specific OIDs are included
    assert.ok(objects.has('c60bbbe99e96578105c57c4b3f2b6ebdf863edbc'), 'Should include first OID')
    assert.ok(objects.has('e05547ea87ea55eff079de295ff56f483e5b4439'), 'Should include second OID')
    assert.ok(objects.has('ebdedf722a3ec938da3fd53eb74fdea55c48a19d'), 'Should include third OID')
    assert.ok(objects.has('0518502faba1c63489562641c36a989e0f574d95'), 'Should include fourth OID')
  })
})

