import { test } from 'node:test'
import assert from 'node:assert'
import { compareAge } from '../../src/utils/compareAge.ts'
import type { CommitObject } from '../../src/models/GitCommit.ts'

test('compareAge', async (t) => {
  await t.test('compare commits - first is older', () => {
    const a: CommitObject = {
      tree: 'a'.repeat(40),
      parent: [],
      author: { name: 'Test', email: 'test@example.com', timestamp: 1000, timezoneOffset: 0 },
      committer: { name: 'Test', email: 'test@example.com', timestamp: 1000, timezoneOffset: 0 },
      message: 'First commit',
    }
    const b: CommitObject = {
      tree: 'b'.repeat(40),
      parent: [],
      author: { name: 'Test', email: 'test@example.com', timestamp: 2000, timezoneOffset: 0 },
      committer: { name: 'Test', email: 'test@example.com', timestamp: 2000, timezoneOffset: 0 },
      message: 'Second commit',
    }

    const result = compareAge(a, b)
    assert.strictEqual(result, -1000) // a is older (negative)
  })

  await t.test('compare commits - second is older', () => {
    const a: CommitObject = {
      tree: 'a'.repeat(40),
      parent: [],
      author: { name: 'Test', email: 'test@example.com', timestamp: 2000, timezoneOffset: 0 },
      committer: { name: 'Test', email: 'test@example.com', timestamp: 2000, timezoneOffset: 0 },
      message: 'First commit',
    }
    const b: CommitObject = {
      tree: 'b'.repeat(40),
      parent: [],
      author: { name: 'Test', email: 'test@example.com', timestamp: 1000, timezoneOffset: 0 },
      committer: { name: 'Test', email: 'test@example.com', timestamp: 1000, timezoneOffset: 0 },
      message: 'Second commit',
    }

    const result = compareAge(a, b)
    assert.strictEqual(result, 1000) // a is newer (positive)
  })

  await t.test('compare commits - same age', () => {
    const a: CommitObject = {
      tree: 'a'.repeat(40),
      parent: [],
      author: { name: 'Test', email: 'test@example.com', timestamp: 1500, timezoneOffset: 0 },
      committer: { name: 'Test', email: 'test@example.com', timestamp: 1500, timezoneOffset: 0 },
      message: 'First commit',
    }
    const b: CommitObject = {
      tree: 'b'.repeat(40),
      parent: [],
      author: { name: 'Test', email: 'test@example.com', timestamp: 1500, timezoneOffset: 0 },
      committer: { name: 'Test', email: 'test@example.com', timestamp: 1500, timezoneOffset: 0 },
      message: 'Second commit',
    }

    const result = compareAge(a, b)
    assert.strictEqual(result, 0) // same age
  })

  await t.test('compare commits - uses committer timestamp', () => {
    const a: CommitObject = {
      tree: 'a'.repeat(40),
      parent: [],
      author: { name: 'Test', email: 'test@example.com', timestamp: 1000, timezoneOffset: 0 },
      committer: { name: 'Test', email: 'test@example.com', timestamp: 5000, timezoneOffset: 0 },
      message: 'First commit',
    }
    const b: CommitObject = {
      tree: 'b'.repeat(40),
      parent: [],
      author: { name: 'Test', email: 'test@example.com', timestamp: 2000, timezoneOffset: 0 },
      committer: { name: 'Test', email: 'test@example.com', timestamp: 3000, timezoneOffset: 0 },
      message: 'Second commit',
    }

    const result = compareAge(a, b)
    // Should use committer timestamp (5000 - 3000 = 2000)
    assert.strictEqual(result, 2000)
  })
})

