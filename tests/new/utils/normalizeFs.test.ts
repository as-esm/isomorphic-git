import { test } from 'node:test'
import assert from 'node:assert'
import { normalizeFs } from '../../../src/utils/normalizeFs.ts'
import { FileSystem } from '../../../src/models/FileSystem.ts'
import * as fs from 'fs'

test('normalizeFs', async (t) => {
  await t.test('wraps raw fs module', () => {
    const normalized = normalizeFs(fs)
    
    assert.ok(normalized instanceof FileSystem)
  })

  await t.test('returns same instance if already FileSystem', () => {
    const fs1 = new FileSystem(fs)
    const fs2 = normalizeFs(fs1)
    
    assert.strictEqual(fs1, fs2)
  })

  await t.test('normalized fs has FileSystem methods', async () => {
    const normalized = normalizeFs(fs)
    
    assert.ok(typeof normalized.read === 'function')
    assert.ok(typeof normalized.write === 'function')
    assert.ok(typeof normalized.exists === 'function')
  })
})

