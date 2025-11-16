import { test } from 'node:test'
import assert from 'node:assert'
import { parseUploadPackResponse } from '../../src/wire/parseUploadPackResponse.ts'
import { GitPktLine } from '../../src/models/GitPktLine.ts'
import { InvalidOidError } from '../../src/errors/InvalidOidError.ts'

// Helper function to create an async iterable from an array of buffers
async function* createStream(buffers: Buffer[]): AsyncIterableIterator<Uint8Array> {
  for (const buffer of buffers) {
    yield buffer
  }
}

test('parseUploadPackResponse', async (t) => {
  await t.test('parse ACK response', async () => {
    const oid = 'a'.repeat(40)
    const response = [
      GitPktLine.encode(`ACK ${oid}\n`),
      GitPktLine.flush(),
    ]
    const stream = createStream(response)

    const result = await parseUploadPackResponse(stream)

    assert.strictEqual(result.acks.length, 1)
    assert.strictEqual(result.acks[0].oid, oid)
    assert.strictEqual(result.acks[0].status, undefined)
    assert.strictEqual(result.nak, false)
    assert.strictEqual(result.shallows.length, 0)
    assert.strictEqual(result.unshallows.length, 0)
  })

  await t.test('parse ACK with status', async () => {
    const oid = 'b'.repeat(40)
    const response = [
      GitPktLine.encode(`ACK ${oid} common\n`),
      GitPktLine.flush(),
    ]
    const stream = createStream(response)

    const result = await parseUploadPackResponse(stream)

    assert.strictEqual(result.acks.length, 1)
    assert.strictEqual(result.acks[0].oid, oid)
    assert.strictEqual(result.acks[0].status, 'common')
    assert.strictEqual(result.nak, false)
  })

  await t.test('parse multiple ACKs', async () => {
    const oid1 = 'c'.repeat(40)
    const oid2 = 'd'.repeat(40)
    const response = [
      GitPktLine.encode(`ACK ${oid1} common\n`),
      GitPktLine.encode(`ACK ${oid2}\n`),
      GitPktLine.flush(),
    ]
    const stream = createStream(response)

    const result = await parseUploadPackResponse(stream)

    assert.strictEqual(result.acks.length, 2)
    assert.strictEqual(result.acks[0].oid, oid1)
    assert.strictEqual(result.acks[0].status, 'common')
    assert.strictEqual(result.acks[1].oid, oid2)
    assert.strictEqual(result.acks[1].status, undefined)
  })

  await t.test('parse NAK response', async () => {
    const response = [
      GitPktLine.encode('NAK\n'),
      GitPktLine.flush(),
    ]
    const stream = createStream(response)

    const result = await parseUploadPackResponse(stream)

    assert.strictEqual(result.nak, true)
    assert.strictEqual(result.acks.length, 0)
  })

  await t.test('parse shallow response', async () => {
    const oid = 'e'.repeat(40)
    const response = [
      GitPktLine.encode(`shallow ${oid}\n`),
      GitPktLine.flush(),
    ]
    const stream = createStream(response)

    const result = await parseUploadPackResponse(stream)

    assert.strictEqual(result.shallows.length, 1)
    assert.strictEqual(result.shallows[0], oid)
    assert.strictEqual(result.unshallows.length, 0)
  })

  await t.test('parse multiple shallows', async () => {
    const oid1 = 'f'.repeat(40)
    const oid2 = '1'.repeat(40)
    const response = [
      GitPktLine.encode(`shallow ${oid1}\n`),
      GitPktLine.encode(`shallow ${oid2}\n`),
      GitPktLine.flush(),
    ]
    const stream = createStream(response)

    const result = await parseUploadPackResponse(stream)

    assert.strictEqual(result.shallows.length, 2)
    assert.strictEqual(result.shallows[0], oid1)
    assert.strictEqual(result.shallows[1], oid2)
  })

  await t.test('parse unshallow response', async () => {
    const oid = '2'.repeat(40)
    const response = [
      GitPktLine.encode(`unshallow ${oid}\n`),
      GitPktLine.flush(),
    ]
    const stream = createStream(response)

    const result = await parseUploadPackResponse(stream)

    assert.strictEqual(result.unshallows.length, 1)
    assert.strictEqual(result.unshallows[0], oid)
    assert.strictEqual(result.shallows.length, 0)
  })

  await t.test('parse mixed shallow and unshallow', async () => {
    const shallowOid = '3'.repeat(40)
    const unshallowOid = '4'.repeat(40)
    const response = [
      GitPktLine.encode(`shallow ${shallowOid}\n`),
      GitPktLine.encode(`unshallow ${unshallowOid}\n`),
      GitPktLine.flush(),
    ]
    const stream = createStream(response)

    const result = await parseUploadPackResponse(stream)

    assert.strictEqual(result.shallows.length, 1)
    assert.strictEqual(result.shallows[0], shallowOid)
    assert.strictEqual(result.unshallows.length, 1)
    assert.strictEqual(result.unshallows[0], unshallowOid)
  })

  await t.test('parse shallow with invalid OID length throws error', async () => {
    const invalidOid = 'short'
    const response = [
      GitPktLine.encode(`shallow ${invalidOid}\n`),
      GitPktLine.flush(),
    ]
    const stream = createStream(response)

    let error: unknown = null
    try {
      await parseUploadPackResponse(stream)
    } catch (err) {
      error = err
    }

    assert.notStrictEqual(error, null)
    assert.ok(error instanceof InvalidOidError)
  })

  await t.test('parse unshallow with invalid OID length throws error', async () => {
    const invalidOid = 'also-too-short'
    const response = [
      GitPktLine.encode(`unshallow ${invalidOid}\n`),
      GitPktLine.flush(),
    ]
    const stream = createStream(response)

    let error: unknown = null
    try {
      await parseUploadPackResponse(stream)
    } catch (err) {
      error = err
    }

    assert.notStrictEqual(error, null)
    assert.ok(error instanceof InvalidOidError)
  })

  await t.test('parse ACK followed by NAK (ACK resolves first)', async () => {
    const oid = '5'.repeat(40)
    const response = [
      GitPktLine.encode(`ACK ${oid}\n`),
      GitPktLine.encode('NAK\n'),
      GitPktLine.flush(),
    ]
    const stream = createStream(response)

    const result = await parseUploadPackResponse(stream)

    // ACK without status sets done=true immediately, so NAK is never processed
    assert.strictEqual(result.acks.length, 1)
    assert.strictEqual(result.nak, false) // NAK never processed because done=true from ACK
  })

  await t.test('parse unknown line defaults to NAK', async () => {
    const response = [
      GitPktLine.encode('unknown line\n'),
      GitPktLine.flush(),
    ]
    const stream = createStream(response)

    const result = await parseUploadPackResponse(stream)

    assert.strictEqual(result.nak, true)
    assert.strictEqual(result.acks.length, 0)
  })

  await t.test('parse empty response (flush only)', async () => {
    const response = [
      GitPktLine.flush(),
    ]
    const stream = createStream(response)

    const result = await parseUploadPackResponse(stream)

    // Empty response (just flush) resolves in finally with initial values
    assert.strictEqual(result.nak, false) // Initial value, no NAK seen
    assert.strictEqual(result.acks.length, 0)
  })

  await t.test('parse ACK with done status', async () => {
    const oid = '6'.repeat(40)
    const response = [
      GitPktLine.encode(`ACK ${oid}\n`),
      GitPktLine.flush(),
    ]
    const stream = createStream(response)

    const result = await parseUploadPackResponse(stream)

    assert.strictEqual(result.acks.length, 1)
    assert.strictEqual(result.acks[0].oid, oid)
    // When status is undefined, done should be true
  })
})

