import { test } from 'node:test'
import assert from 'node:assert'
import { detectObjectFormat, getOidLength, validateOid } from '../../src/utils/detectObjectFormat.ts'
import { makeFixture } from '../helpers/fixture.ts'
import { init, setConfig } from 'isomorphic-git'

test('detectObjectFormat', async (t) => {
  await t.test('detects SHA-1 format by default', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    const format = await detectObjectFormat(fs, gitdir)
    assert.strictEqual(format, 'sha1')
  })

  await t.test('detects SHA-256 format when configured', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Set objectformat to sha256
    await setConfig({ fs, dir, gitdir, path: 'extensions.objectformat', value: 'sha256' })
    
    const format = await detectObjectFormat(fs, gitdir)
    assert.strictEqual(format, 'sha256')
  })

  await t.test('handles missing config file', async () => {
    const { fs } = await makeFixture('test-empty')
    // Use a non-existent gitdir
    const format = await detectObjectFormat(fs, '/nonexistent/gitdir')
    // Should default to SHA-1
    assert.strictEqual(format, 'sha1')
  })

  await t.test('handles config without extensions section', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Config exists but no extensions section
    const format = await detectObjectFormat(fs, gitdir)
    assert.strictEqual(format, 'sha1')
  })

  await t.test('handles config with extensions section but no objectformat', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Add extensions section without objectformat
    await setConfig({ fs, dir, gitdir, path: 'extensions.worktreeconfig', value: 'true' })
    
    const format = await detectObjectFormat(fs, gitdir)
    assert.strictEqual(format, 'sha1')
  })

  await t.test('handles case-insensitive objectformat value', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-empty')
    await init({ fs, dir, defaultBranch: 'main' })
    
    // Write config directly with different case
    const configPath = `${gitdir}/config`
    const configContent = `[extensions]
objectformat = SHA256
`
    await fs.write(configPath, configContent, 'utf8')
    
    const format = await detectObjectFormat(fs, gitdir)
    assert.strictEqual(format, 'sha256')
  })
})

test('getOidLength', async (t) => {
  await t.test('returns 40 for SHA-1', () => {
    assert.strictEqual(getOidLength('sha1'), 40)
  })

  await t.test('returns 64 for SHA-256', () => {
    assert.strictEqual(getOidLength('sha256'), 64)
  })
})

test('validateOid', async (t) => {
  await t.test('validates SHA-1 OID', () => {
    const validSha1 = 'a'.repeat(40)
    assert.strictEqual(validateOid(validSha1, 'sha1'), true)
  })

  await t.test('validates SHA-256 OID', () => {
    const validSha256 = 'a'.repeat(64)
    assert.strictEqual(validateOid(validSha256, 'sha256'), true)
  })

  await t.test('rejects SHA-1 OID with wrong length', () => {
    const wrongLength = 'a'.repeat(39)
    assert.strictEqual(validateOid(wrongLength, 'sha1'), false)
  })

  await t.test('rejects SHA-256 OID with wrong length', () => {
    const wrongLength = 'a'.repeat(63)
    assert.strictEqual(validateOid(wrongLength, 'sha256'), false)
  })

  await t.test('rejects OID with invalid characters', () => {
    const invalidOid = 'g'.repeat(40)
    assert.strictEqual(validateOid(invalidOid, 'sha1'), false)
  })

  await t.test('accepts uppercase hex characters', () => {
    const uppercaseOid = 'A'.repeat(40)
    assert.strictEqual(validateOid(uppercaseOid, 'sha1'), true)
  })

  await t.test('accepts mixed case hex characters', () => {
    const mixedCaseOid = 'aBcDeF0123456789'.repeat(2) + 'aBcDeF0123456789'.slice(0, 8)
    assert.strictEqual(validateOid(mixedCaseOid, 'sha1'), true)
  })
})

