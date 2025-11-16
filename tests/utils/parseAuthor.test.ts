import { test } from 'node:test'
import assert from 'node:assert'
import { parseAuthor } from '../../src/utils/parseAuthor.ts'

test('parseAuthor', async (t) => {
  await t.test('parses author with positive timezone offset', () => {
    const authorString = 'Test User <test@example.com> 1234567890 +0200'
    const author = parseAuthor(authorString)
    assert.strictEqual(author.name, 'Test User')
    assert.strictEqual(author.email, 'test@example.com')
    assert.strictEqual(author.timestamp, 1234567890)
    assert.strictEqual(author.timezoneOffset, -120) // Note: negated except for zero
  })

  await t.test('parses author with negative timezone offset', () => {
    const authorString = 'Test User <test@example.com> 1234567890 -0500'
    const author = parseAuthor(authorString)
    assert.strictEqual(author.name, 'Test User')
    assert.strictEqual(author.email, 'test@example.com')
    assert.strictEqual(author.timestamp, 1234567890)
    assert.strictEqual(author.timezoneOffset, 300) // Note: negated except for zero
  })

  await t.test('parses author with zero timezone offset', () => {
    const authorString = 'Test User <test@example.com> 1234567890 +0000'
    const author = parseAuthor(authorString)
    assert.strictEqual(author.name, 'Test User')
    assert.strictEqual(author.email, 'test@example.com')
    assert.strictEqual(author.timestamp, 1234567890)
    assert.strictEqual(author.timezoneOffset, 0)
  })

  await t.test('parses author with negative zero timezone offset', () => {
    const authorString = 'Test User <test@example.com> 1234567890 -0000'
    const author = parseAuthor(authorString)
    assert.strictEqual(author.name, 'Test User')
    assert.strictEqual(author.email, 'test@example.com')
    assert.strictEqual(author.timestamp, 1234567890)
    // -0 should be preserved as -0 (but negateExceptForZero makes it 0)
    // Use Object.is to check for -0 vs 0
    assert.ok(Object.is(author.timezoneOffset, 0) || Object.is(author.timezoneOffset, -0), 
      'Timezone offset should be 0 or -0')
  })

  await t.test('parses author with single-digit hours and minutes', () => {
    const authorString = 'Test User <test@example.com> 1234567890 +0130'
    const author = parseAuthor(authorString)
    assert.strictEqual(author.name, 'Test User')
    assert.strictEqual(author.email, 'test@example.com')
    assert.strictEqual(author.timestamp, 1234567890)
    assert.strictEqual(author.timezoneOffset, -90) // Note: negated except for zero
  })

  await t.test('parses author with name containing special characters', () => {
    const authorString = 'Test <User> <test@example.com> 1234567890 +0000'
    const author = parseAuthor(authorString)
    assert.strictEqual(author.name, 'Test <User>')
    assert.strictEqual(author.email, 'test@example.com')
    assert.strictEqual(author.timestamp, 1234567890)
    assert.strictEqual(author.timezoneOffset, 0)
  })

  await t.test('parses author with email containing special characters', () => {
    const authorString = 'Test User <test+tag@example.com> 1234567890 +0000'
    const author = parseAuthor(authorString)
    assert.strictEqual(author.name, 'Test User')
    assert.strictEqual(author.email, 'test+tag@example.com')
    assert.strictEqual(author.timestamp, 1234567890)
    assert.strictEqual(author.timezoneOffset, 0)
  })

  await t.test('throws error for invalid author format', () => {
    try {
      parseAuthor('Invalid format')
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.ok(error instanceof Error)
      assert.ok((error as Error).message.includes('Invalid author format'))
    }
  })

  await t.test('throws error for invalid timezone offset format', () => {
    try {
      parseAuthor('Test User <test@example.com> 1234567890 invalid')
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.ok(error instanceof Error)
      assert.ok((error as Error).message.includes('Invalid timezone offset format'))
    }
  })

  await t.test('round-trip: format and parse', async () => {
    const original = {
      name: 'Test User',
      email: 'test@example.com',
      timestamp: 1234567890,
      timezoneOffset: 120,
    }
    const { formatAuthor } = await import('../../src/utils/formatAuthor.ts')
    const formatted = formatAuthor(original)
    const parsed = parseAuthor(formatted)
    // Note: timezoneOffset is negated in both formatAuthor and parseAuthor
    // formatAuthor negates it, parseAuthor negates it again, so we get back the original
    assert.strictEqual(parsed.name, original.name)
    assert.strictEqual(parsed.email, original.email)
    assert.strictEqual(parsed.timestamp, original.timestamp)
    // Both functions negate (except for zero), so we get back the original
    assert.strictEqual(parsed.timezoneOffset, original.timezoneOffset)
  })
})

