import { test } from 'node:test'
import assert from 'node:assert'
import { collect } from '../../src/utils/collect.ts'

test('collect', async (t) => {
  await t.test('collects array of buffers into single Uint8Array', async () => {
    const buffers = [
      Buffer.from([1, 2, 3]),
      Buffer.from([4, 5, 6]),
      Buffer.from([7, 8, 9]),
    ]
    const result = await collect(buffers)
    assert.ok(result instanceof Uint8Array)
    assert.strictEqual(result.length, 9)
    assert.deepStrictEqual(Array.from(result), [1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  await t.test('collects async iterable of buffers', async () => {
    async function* generateBuffers() {
      yield Buffer.from([10, 20])
      yield Buffer.from([30, 40])
      yield Buffer.from([50])
    }
    const result = await collect(generateBuffers())
    assert.strictEqual(result.length, 5)
    assert.deepStrictEqual(Array.from(result), [10, 20, 30, 40, 50])
  })

  await t.test('handles empty iterable', async () => {
    const result = await collect([])
    assert.ok(result instanceof Uint8Array)
    assert.strictEqual(result.length, 0)
  })

  await t.test('handles single buffer', async () => {
    const buffers = [Buffer.from([42, 43, 44])]
    const result = await collect(buffers)
    assert.strictEqual(result.length, 3)
    assert.deepStrictEqual(Array.from(result), [42, 43, 44])
  })

  await t.test('handles Uint8Array inputs', async () => {
    const buffers = [
      new Uint8Array([1, 2]),
      new Uint8Array([3, 4]),
    ]
    const result = await collect(buffers)
    assert.strictEqual(result.length, 4)
    assert.deepStrictEqual(Array.from(result), [1, 2, 3, 4])
  })

  await t.test('handles mixed Buffer and Uint8Array', async () => {
    const buffers = [
      Buffer.from([1, 2]),
      new Uint8Array([3, 4]),
      Buffer.from([5]),
    ]
    const result = await collect(buffers)
    assert.strictEqual(result.length, 5)
    assert.deepStrictEqual(Array.from(result), [1, 2, 3, 4, 5])
  })

  await t.test('handles large buffers', async () => {
    const largeBuffer = Buffer.alloc(1000, 0x42)
    const result = await collect([largeBuffer])
    assert.strictEqual(result.length, 1000)
    assert.strictEqual(result[0], 0x42)
    assert.strictEqual(result[999], 0x42)
  })
})

