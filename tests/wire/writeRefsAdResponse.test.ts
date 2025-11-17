import { test } from 'node:test'
import assert from 'node:assert'
import { writeRefsAdResponse } from '../../src/wire/writeRefsAdResponse.ts'
import { collect } from '../../src/utils/collect.ts'

test('writeRefsAdResponse', async (t) => {
  await t.test('write refs advertisement with multiple refs and capabilities', async () => {
    const res = await writeRefsAdResponse({
      service: 'git-upload-pack',
      capabilities: [
        'multi_ack',
        'thin-pack',
        'side-band',
        'side-band-64k',
        'ofs-delta',
        'shallow',
        'deepen-since',
        'deepen-not',
        'deepen-relative',
        'no-progress',
        'include-tag',
        'multi_ack_detailed',
        'no-done',
      ],
      symrefs: { HEAD: 'refs/heads/master' },
      refs: {
        HEAD: '9ea43b479f5fedc679e3eb37803275d727bf51b7',
        'refs/heads/js2': 'fb74ea1a9b6a9601df18c38d3de751c51f064bf7',
        'refs/heads/js3': '5faa96fe725306e060386975a70e4b6eacb576ed',
        'refs/heads/master': '9ea43b479f5fedc679e3eb37803275d727bf51b7',
        'refs/heads/master2': 'c1751a5447a7b025e5bca507af483dde7b0b956f',
        'refs/heads/master3': 'd85135a47c42c9c906e20c08def2fbceac4c2a4f',
        'refs/heads/master4': '18f4b62440abf61285fbfdcbfd990ab8434ff35c',
        'refs/heads/master5': 'e5c144897b64a44bd1164a0db60738452c9eaf87',
      },
    })
    
    const buffer = Buffer.from(await collect(res))
    const result = buffer.toString('utf8')
    
    // Verify HEAD is first
    assert.ok(result.includes('9ea43b479f5fedc679e3eb37803275d727bf51b7 HEAD'), 'HEAD should be first')
    // Verify capabilities
    assert.ok(result.includes('multi_ack'), 'Should contain multi_ack')
    assert.ok(result.includes('thin-pack'), 'Should contain thin-pack')
    assert.ok(result.includes('symref=HEAD:refs/heads/master'), 'Should contain symref')
    // Verify refs
    assert.ok(result.includes('refs/heads/js2'), 'Should contain refs/heads/js2')
    assert.ok(result.includes('refs/heads/master'), 'Should contain refs/heads/master')
    assert.ok(result.includes('refs/heads/master5'), 'Should contain refs/heads/master5')
  })
})

