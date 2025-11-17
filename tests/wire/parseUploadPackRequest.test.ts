import { test } from 'node:test'
import assert from 'node:assert'
import { parseUploadPackRequest } from '../../src/wire/parseUploadPackRequest.ts'

// Helper function to create an async iterable from an array of buffers
async function* createStream(buffers: Buffer[]): AsyncIterableIterator<Uint8Array> {
  for (const buffer of buffers) {
    yield buffer
  }
}

test('parseUploadPackRequest', async (t) => {
  await t.test('parse request with multiple wants and capabilities', async () => {
    const req = [
      Buffer.from(`008awant fb74ea1a9b6a9601df18c38d3de751c51f064bf7 multi_ack_detailed no-done side-band-64k thin-pack ofs-delta agent=git/2.10.1.windows.1
0032want 5faa96fe725306e060386975a70e4b6eacb576ed
0032want 9ea43b479f5fedc679e3eb37803275d727bf51b7
0032want c1751a5447a7b025e5bca507af483dde7b0b956f
0032want d85135a47c42c9c906e20c08def2fbceac4c2a4f
0032want 18f4b62440abf61285fbfdcbfd990ab8434ff35c
0032want e5c144897b64a44bd1164a0db60738452c9eaf87
00000009done
`),
    ]
    const stream = createStream(req)
    const result = await parseUploadPackRequest(stream)
    
    assert.deepStrictEqual([...result.capabilities], [
      'multi_ack_detailed',
      'no-done',
      'side-band-64k',
      'thin-pack',
      'ofs-delta',
      'agent=git/2.10.1.windows.1',
    ])
    assert.deepStrictEqual([...result.wants], [
      'fb74ea1a9b6a9601df18c38d3de751c51f064bf7',
      '5faa96fe725306e060386975a70e4b6eacb576ed',
      '9ea43b479f5fedc679e3eb37803275d727bf51b7',
      'c1751a5447a7b025e5bca507af483dde7b0b956f',
      'd85135a47c42c9c906e20c08def2fbceac4c2a4f',
      '18f4b62440abf61285fbfdcbfd990ab8434ff35c',
      'e5c144897b64a44bd1164a0db60738452c9eaf87',
    ])
    assert.strictEqual(result.done, true)
  })
})

