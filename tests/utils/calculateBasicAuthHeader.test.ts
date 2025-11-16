import { test } from 'node:test'
import assert from 'node:assert'
import { calculateBasicAuthHeader } from '../../src/utils/calculateBasicAuthHeader.ts'

test('calculateBasicAuthHeader', async (t) => {
  await t.test('creates Basic auth header with username and password', () => {
    const header = calculateBasicAuthHeader({ username: 'user', password: 'pass' })
    assert.strictEqual(header, 'Basic dXNlcjpwYXNz')
    // Verify it's valid base64
    const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf8')
    assert.strictEqual(decoded, 'user:pass')
  })

  await t.test('creates Basic auth header with empty strings', () => {
    const header = calculateBasicAuthHeader({ username: '', password: '' })
    assert.strictEqual(header, 'Basic Og==')
    const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf8')
    assert.strictEqual(decoded, ':')
  })

  await t.test('creates Basic auth header with default empty values', () => {
    const header = calculateBasicAuthHeader({})
    assert.strictEqual(header, 'Basic Og==')
    const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf8')
    assert.strictEqual(decoded, ':')
  })

  await t.test('creates Basic auth header with special characters', () => {
    const header = calculateBasicAuthHeader({ username: 'user@domain', password: 'p@ss:w0rd' })
    assert.ok(header.startsWith('Basic '))
    const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf8')
    assert.strictEqual(decoded, 'user@domain:p@ss:w0rd')
  })

  await t.test('creates Basic auth header with unicode characters', () => {
    const header = calculateBasicAuthHeader({ username: 'üser', password: 'päss' })
    assert.ok(header.startsWith('Basic '))
    const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf8')
    assert.strictEqual(decoded, 'üser:päss')
  })

  await t.test('creates Basic auth header with only username', () => {
    const header = calculateBasicAuthHeader({ username: 'user' })
    assert.ok(header.startsWith('Basic '))
    const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf8')
    assert.strictEqual(decoded, 'user:')
  })

  await t.test('creates Basic auth header with only password', () => {
    const header = calculateBasicAuthHeader({ password: 'pass' })
    assert.ok(header.startsWith('Basic '))
    const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf8')
    assert.strictEqual(decoded, ':pass')
  })
})

