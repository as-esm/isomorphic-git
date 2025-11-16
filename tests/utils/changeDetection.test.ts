import { test } from 'node:test'
import assert from 'node:assert'
import { detectChange, detectThreeWayChange, modified } from '../../src/utils/changeDetection.ts'
import type { WalkerEntry } from '../../src/models/Walker.ts'

// Mock WalkerEntry for testing
class MockWalkerEntry implements WalkerEntry {
  private _oid: string
  private _type: 'blob' | 'tree' | 'commit' | 'tag' | 'special'
  private _mode: number

  constructor(oid: string, type: 'blob' | 'tree' | 'commit' | 'tag' | 'special' = 'blob', mode: number = 0o100644) {
    this._oid = oid
    this._type = type
    this._mode = mode
  }

  async oid(): Promise<string> {
    return this._oid
  }

  async type(): Promise<'blob' | 'tree' | 'commit' | 'tag' | 'special'> {
    return this._type
  }

  async mode(): Promise<number> {
    return this._mode
  }

  async content(): Promise<Uint8Array> {
    throw new Error('Not implemented')
  }

  async stat(): Promise<any> {
    throw new Error('Not implemented')
  }
}

// Mock WalkerEntry that throws on oid() call
class FailingWalkerEntry implements WalkerEntry {
  async oid(): Promise<string> {
    throw new Error('Missing blob')
  }

  async type(): Promise<'blob' | 'tree' | 'commit' | 'tag' | 'special'> {
    return 'blob'
  }

  async mode(): Promise<number> {
    return 0o100644
  }

  async content(): Promise<Uint8Array> {
    throw new Error('Not implemented')
  }

  async stat(): Promise<any> {
    throw new Error('Not implemented')
  }
}

test('changeDetection', async (t) => {
  await t.test('detectChange - detects added file', async () => {
    const base = null
    const target = new MockWalkerEntry('abc123')
    const result = await detectChange(base, target)
    assert.strictEqual(result.type, 'added')
    assert.strictEqual(result.base, null)
    assert.strictEqual(result.target, target)
    assert.strictEqual(result.baseOid, undefined)
    assert.strictEqual(result.targetOid, 'abc123')
  })

  await t.test('detectChange - detects deleted file', async () => {
    const base = new MockWalkerEntry('abc123')
    const target = null
    const result = await detectChange(base, target)
    assert.strictEqual(result.type, 'deleted')
    assert.strictEqual(result.base, base)
    assert.strictEqual(result.target, null)
    assert.strictEqual(result.baseOid, 'abc123')
    assert.strictEqual(result.targetOid, undefined)
  })

  await t.test('detectChange - detects modified file', async () => {
    const base = new MockWalkerEntry('abc123')
    const target = new MockWalkerEntry('def456')
    const result = await detectChange(base, target)
    assert.strictEqual(result.type, 'modified')
    assert.strictEqual(result.base, base)
    assert.strictEqual(result.target, target)
    assert.strictEqual(result.baseOid, 'abc123')
    assert.strictEqual(result.targetOid, 'def456')
  })

  await t.test('detectChange - detects unchanged file', async () => {
    const base = new MockWalkerEntry('abc123')
    const target = new MockWalkerEntry('abc123')
    const result = await detectChange(base, target)
    assert.strictEqual(result.type, 'unchanged')
    assert.strictEqual(result.base, base)
    assert.strictEqual(result.target, target)
    assert.strictEqual(result.baseOid, 'abc123')
    assert.strictEqual(result.targetOid, 'abc123')
  })

  await t.test('detectChange - handles both null (unchanged)', async () => {
    const base = null
    const target = null
    const result = await detectChange(base, target)
    assert.strictEqual(result.type, 'unchanged')
    assert.strictEqual(result.base, null)
    assert.strictEqual(result.target, null)
    assert.strictEqual(result.baseOid, undefined)
    assert.strictEqual(result.targetOid, undefined)
  })

  await t.test('detectChange - handles missing blob in base', async () => {
    const base = new FailingWalkerEntry()
    const target = new MockWalkerEntry('abc123')
    const result = await detectChange(base, target)
    // When base.oid() fails, baseOid is undefined but base is not null
    // So it's treated as modified (both exist, but OIDs differ)
    assert.strictEqual(result.type, 'modified')
    assert.strictEqual(result.baseOid, undefined)
    assert.strictEqual(result.targetOid, 'abc123')
  })

  await t.test('detectChange - handles missing blob in target', async () => {
    const base = new MockWalkerEntry('abc123')
    const target = new FailingWalkerEntry()
    const result = await detectChange(base, target)
    // Should return unchanged when target.oid() fails
    assert.strictEqual(result.type, 'unchanged')
    assert.strictEqual(result.baseOid, undefined)
    assert.strictEqual(result.targetOid, undefined)
  })

  await t.test('detectThreeWayChange - detects our change', async () => {
    const ours = new MockWalkerEntry('abc123')
    const base = new MockWalkerEntry('def456')
    const theirs = new MockWalkerEntry('def456')
    const result = await detectThreeWayChange(ours, base, theirs)
    assert.strictEqual(result.ourChange, true)
    assert.strictEqual(result.theirChange, false)
    assert.strictEqual(result.ourOid, 'abc123')
    assert.strictEqual(result.baseOid, 'def456')
    assert.strictEqual(result.theirOid, 'def456')
  })

  await t.test('detectThreeWayChange - detects their change', async () => {
    const ours = new MockWalkerEntry('def456')
    const base = new MockWalkerEntry('def456')
    const theirs = new MockWalkerEntry('abc123')
    const result = await detectThreeWayChange(ours, base, theirs)
    assert.strictEqual(result.ourChange, false)
    assert.strictEqual(result.theirChange, true)
    assert.strictEqual(result.ourOid, 'def456')
    assert.strictEqual(result.baseOid, 'def456')
    assert.strictEqual(result.theirOid, 'abc123')
  })

  await t.test('detectThreeWayChange - detects both changes', async () => {
    const ours = new MockWalkerEntry('abc123')
    const base = new MockWalkerEntry('def456')
    const theirs = new MockWalkerEntry('ghi789')
    const result = await detectThreeWayChange(ours, base, theirs)
    assert.strictEqual(result.ourChange, true)
    assert.strictEqual(result.theirChange, true)
    assert.strictEqual(result.ourOid, 'abc123')
    assert.strictEqual(result.baseOid, 'def456')
    assert.strictEqual(result.theirOid, 'ghi789')
  })

  await t.test('detectThreeWayChange - detects no changes', async () => {
    const ours = new MockWalkerEntry('abc123')
    const base = new MockWalkerEntry('abc123')
    const theirs = new MockWalkerEntry('abc123')
    const result = await detectThreeWayChange(ours, base, theirs)
    assert.strictEqual(result.ourChange, false)
    assert.strictEqual(result.theirChange, false)
    assert.strictEqual(result.ourOid, 'abc123')
    assert.strictEqual(result.baseOid, 'abc123')
    assert.strictEqual(result.theirOid, 'abc123')
  })

  await t.test('detectThreeWayChange - detects our deletion', async () => {
    const ours = null
    const base = new MockWalkerEntry('abc123')
    const theirs = new MockWalkerEntry('abc123')
    const result = await detectThreeWayChange(ours, base, theirs)
    assert.strictEqual(result.ourChange, true) // ours is null, base is not
    assert.strictEqual(result.theirChange, false)
    assert.strictEqual(result.ourOid, undefined)
    assert.strictEqual(result.baseOid, 'abc123')
    assert.strictEqual(result.theirOid, 'abc123')
  })

  await t.test('detectThreeWayChange - detects their deletion', async () => {
    const ours = new MockWalkerEntry('abc123')
    const base = new MockWalkerEntry('abc123')
    const theirs = null
    const result = await detectThreeWayChange(ours, base, theirs)
    assert.strictEqual(result.ourChange, false)
    assert.strictEqual(result.theirChange, true) // theirs is null, base is not
    assert.strictEqual(result.ourOid, 'abc123')
    assert.strictEqual(result.baseOid, 'abc123')
    assert.strictEqual(result.theirOid, undefined)
  })

  await t.test('detectThreeWayChange - handles missing blobs', async () => {
    const ours = new FailingWalkerEntry()
    const base = new MockWalkerEntry('abc123')
    const theirs = new MockWalkerEntry('abc123')
    const result = await detectThreeWayChange(ours, base, theirs)
    // Should handle error gracefully
    assert.strictEqual(result.ourOid, undefined)
    assert.strictEqual(result.baseOid, 'abc123')
    assert.strictEqual(result.theirOid, 'abc123')
  })

  await t.test('modified - returns false when both are null', async () => {
    const result = await modified(null, null)
    assert.strictEqual(result, false)
  })

  await t.test('modified - returns true when entry exists but base is null', async () => {
    const entry = new MockWalkerEntry('abc123')
    const result = await modified(entry, null)
    assert.strictEqual(result, true)
  })

  await t.test('modified - returns true when entry is null but base exists', async () => {
    const base = new MockWalkerEntry('abc123')
    const result = await modified(null, base)
    assert.strictEqual(result, true)
  })

  await t.test('modified - returns false when both are trees', async () => {
    const entry = new MockWalkerEntry('abc123', 'tree')
    const base = new MockWalkerEntry('def456', 'tree')
    const result = await modified(entry, base)
    assert.strictEqual(result, false)
  })

  await t.test('modified - returns false when identical', async () => {
    const entry = new MockWalkerEntry('abc123', 'blob', 0o100644)
    const base = new MockWalkerEntry('abc123', 'blob', 0o100644)
    const result = await modified(entry, base)
    assert.strictEqual(result, false)
  })

  await t.test('modified - returns true when OID differs', async () => {
    const entry = new MockWalkerEntry('abc123', 'blob', 0o100644)
    const base = new MockWalkerEntry('def456', 'blob', 0o100644)
    const result = await modified(entry, base)
    assert.strictEqual(result, true)
  })

  await t.test('modified - returns true when mode differs', async () => {
    const entry = new MockWalkerEntry('abc123', 'blob', 0o100755)
    const base = new MockWalkerEntry('abc123', 'blob', 0o100644)
    const result = await modified(entry, base)
    assert.strictEqual(result, true)
  })

  await t.test('modified - returns true when type differs', async () => {
    const entry = new MockWalkerEntry('abc123', 'blob', 0o100644)
    const base = new MockWalkerEntry('abc123', 'tree', 0o040000)
    const result = await modified(entry, base)
    assert.strictEqual(result, true)
  })

  await t.test('modified - returns true when oid() throws', async () => {
    const entry = new FailingWalkerEntry()
    const base = new MockWalkerEntry('abc123')
    const result = await modified(entry, base)
    assert.strictEqual(result, true) // Should treat as modified to be safe
  })
})

