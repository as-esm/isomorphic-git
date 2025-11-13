import { test } from 'node:test'
import assert from 'node:assert'
import { Errors, expandOid } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

test('expandOid', async (t) => {
  await t.test('expand short oid', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-expandOid')
    let oid = '033417ae'
    // Test
    oid = await expandOid({ fs, gitdir, oid })
    assert.strictEqual(oid, '033417ae18b174f078f2f44232cb7a374f4c60ce')
  })

  await t.test('expand short oid (not found)', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-expandOid')
    const oid = '01234567'
    // Test
    let error: unknown = null
    try {
      await expandOid({ fs, gitdir, oid })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.NotFoundError)
  })

  await t.test('expand short oid (ambiguous)', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-expandOid')
    const oid = '033417a'
    // Test
    let error: unknown = null
    try {
      await expandOid({ fs, gitdir, oid })
    } catch (err) {
      error = err
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.AmbiguousError)
  })

  await t.test('expand short oid from packfile', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-expandOid')
    let oid = '5f1f014'
    // Test
    oid = await expandOid({ fs, gitdir, oid })
    assert.strictEqual(oid, '5f1f014326b1d7e8079d00b87fa7a9913bd91324')
  })

  await t.test('expand short oid from packfile and loose', async () => {
    // Setup
    const { fs, gitdir } = await makeFixture('test-expandOid')
    // This object is in the pack file as well as being available loose
    let oid = '0001c3'
    // Test
    oid = await expandOid({ fs, gitdir, oid })
    assert.strictEqual(oid, '0001c3e2753b03648b6c43dd74ba7fe2f21123d6')
  })
})

