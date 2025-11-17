import { test } from 'node:test'
import assert from 'node:assert'
import { uploadPack } from '../../src/commands/uploadPack.ts'
import { collect } from '../../src/utils/collect.ts'
import { makeFixture } from '../helpers/fixture.ts'

test('uploadPack', async (t) => {
  await t.test('advertiseRefs: true', async () => {
    const { fs, gitdir } = await makeFixture('test-uploadPack')
    const res = await uploadPack({ fs, gitdir, advertiseRefs: true })
    
    assert.ok(res, 'uploadPack should return a buffer when advertiseRefs is true')
    
    const buffer = Buffer.from(await collect(res!))
    const result = buffer.toString('utf8')
    
    // Verify the response contains expected refs and capabilities
    assert.ok(result.includes('HEAD'), 'Response should contain HEAD')
    assert.ok(result.includes('refs/heads/master'), 'Response should contain refs/heads/master')
    assert.ok(result.includes('thin-pack'), 'Response should contain thin-pack capability')
    assert.ok(result.includes('side-band'), 'Response should contain side-band capability')
    assert.ok(result.includes('side-band-64k'), 'Response should contain side-band-64k capability')
    assert.ok(result.includes('shallow'), 'Response should contain shallow capability')
    assert.ok(result.includes('deepen-since'), 'Response should contain deepen-since capability')
    assert.ok(result.includes('deepen-not'), 'Response should contain deepen-not capability')
    assert.ok(result.includes('allow-tip-sha1-in-want'), 'Response should contain allow-tip-sha1-in-want capability')
    assert.ok(result.includes('allow-reachable-sha1-in-want'), 'Response should contain allow-reachable-sha1-in-want capability')
    assert.ok(result.includes('symref=HEAD:refs/heads/master'), 'Response should contain symref')
  })
})

