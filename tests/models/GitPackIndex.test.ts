import { test } from 'node:test'
import assert from 'node:assert'
import { GitPackIndex, GitObject, shasum } from '../../src/internal-apis.ts'
import { makeFixture } from '../helpers/fixture.ts'
import { join } from '../../src/utils/join.ts'

test('GitPackIndex', async (t) => {
  await t.test('from .idx', async () => {
    const { fs, gitdir } = await makeFixture('test-GitPackIndex')
    const idx = await fs.read(
      join(
        gitdir,
        'objects/pack/pack-1a1e70d2f116e8cb0cb42d26019e5c7d0eb01888.idx'
      )
    )
    const p = await GitPackIndex.fromIdx({ idx })
    const hashSum = await shasum(Buffer.from(JSON.stringify(p.hashes)))
    assert.strictEqual(hashSum, 'fd2404a29d1e5dc72066541366d5f75bc9d51c9b')
    assert.strictEqual(p.packfileSha, '1a1e70d2f116e8cb0cb42d26019e5c7d0eb01888')
    // Test a handful of known offsets.
    assert.strictEqual(p.offsets.get('0b8faa11b353db846b40eb064dfb299816542a46'), 40077)
    assert.strictEqual(p.offsets.get('637c4e69d85e0dcc18898ec251377453d0891585'), 39860)
    assert.strictEqual(p.offsets.get('98e9fde3ee878fa985a143fc5fe05d4e6d8e637b'), 39036)
    assert.strictEqual(p.offsets.get('43c49edb213748626fc363c890c01a9e55a1b8da'), 38202)
    assert.strictEqual(p.offsets.get('5f1f014326b1d7e8079d00b87fa7a9913bd91324'), 20855)
  })

  await t.test('from .pack', async () => {
    const { fs, gitdir } = await makeFixture('test-GitPackIndex')
    const pack = await fs.read(
      join(
        gitdir,
        'objects/pack/pack-1a1e70d2f116e8cb0cb42d26019e5c7d0eb01888.pack'
      )
    )
    const p = await GitPackIndex.fromPack({ pack })
    const hashSum = await shasum(Buffer.from(JSON.stringify(p.hashes)))
    assert.strictEqual(hashSum, 'fd2404a29d1e5dc72066541366d5f75bc9d51c9b')
    assert.strictEqual(p.packfileSha, '1a1e70d2f116e8cb0cb42d26019e5c7d0eb01888')
    // Test a handful of known offsets.
    assert.strictEqual(p.offsets.get('0b8faa11b353db846b40eb064dfb299816542a46'), 40077)
    assert.strictEqual(p.offsets.get('637c4e69d85e0dcc18898ec251377453d0891585'), 39860)
    assert.strictEqual(p.offsets.get('98e9fde3ee878fa985a143fc5fe05d4e6d8e637b'), 39036)
    assert.strictEqual(p.offsets.get('43c49edb213748626fc363c890c01a9e55a1b8da'), 38202)
    assert.strictEqual(p.offsets.get('5f1f014326b1d7e8079d00b87fa7a9913bd91324'), 20855)
  })

  await t.test('from .pack when pack is truncated', async () => {
    const { fs, gitdir } = await makeFixture('test-GitPackIndex')
    const pack = await fs.read(
      join(
        gitdir,
        'objects/pack/pack-1a1e70d2f116e8cb0cb42d26019e5c7d0eb01888.pack'
      )
    )
    const p = await GitPackIndex.fromPack({ pack: pack.slice(0, 12) })
    assert.strictEqual(p.offsets.size, 0)
  })

  await t.test('to .idx file from .pack', async () => {
    const { fs, gitdir } = await makeFixture('test-GitPackIndex')
    const idx = await fs.read(
      join(
        gitdir,
        'objects/pack/pack-1a1e70d2f116e8cb0cb42d26019e5c7d0eb01888.idx'
      )
    )
    const pack = await fs.read(
      join(
        gitdir,
        'objects/pack/pack-1a1e70d2f116e8cb0cb42d26019e5c7d0eb01888.pack'
      )
    )
    const p = await GitPackIndex.fromPack({ pack })
    const idxbuffer = await p.toBuffer()
    assert.strictEqual(idxbuffer.byteLength, idx.byteLength)
    assert.ok(idxbuffer.equals(idx))
  })

  await t.test('read undeltified object', async () => {
    const { fs, gitdir } = await makeFixture('test-GitPackIndex')
    const idx = await fs.read(
      join(
        gitdir,
        'objects/pack/pack-1a1e70d2f116e8cb0cb42d26019e5c7d0eb01888.idx'
      )
    )
    const pack = await fs.read(
      join(
        gitdir,
        'objects/pack/pack-1a1e70d2f116e8cb0cb42d26019e5c7d0eb01888.pack'
      )
    )
    const p = await GitPackIndex.fromIdx({ idx })
    await p.load({ pack })
    const { type, object } = await p.read({
      oid: '637c4e69d85e0dcc18898ec251377453d0891585',
    })
    assert.strictEqual(type, 'commit')
    const oid = await shasum(GitObject.wrap({ type, object }))
    assert.strictEqual(oid, '637c4e69d85e0dcc18898ec251377453d0891585')
    const expectedContent = `tree cbd2a3d7e00a972faaf0ef59d9b421de9f1a7532
parent fbd56b49d400a19ee185ae735417bdb34c084621
parent 0b8faa11b353db846b40eb064dfb299816542a46
author William Hilton <wmhilton@gmail.com> 1508204014 -0400
committer William Hilton <wmhilton@gmail.com> 1508204014 -0400

WIP on master: fbd56b4 Add 'unpkg' key to package.json
`
    assert.strictEqual(object.toString('utf8'), expectedContent)
  })

  await t.test('read deltified object', async () => {
    const { fs, gitdir } = await makeFixture('test-GitPackIndex')
    const idx = await fs.read(
      join(
        gitdir,
        'objects/pack/pack-1a1e70d2f116e8cb0cb42d26019e5c7d0eb01888.idx'
      )
    )
    const pack = await fs.read(
      join(
        gitdir,
        'objects/pack/pack-1a1e70d2f116e8cb0cb42d26019e5c7d0eb01888.pack'
      )
    )
    const p = await GitPackIndex.fromIdx({ idx })
    await p.load({ pack })
    const { type, object } = await p.read({
      oid: '7fb539a8e8488c3fd2793e7dda8a44693e25cce1', // 9 levels deep of deltification.
    })
    assert.strictEqual(type, 'blob')
    const oid = await shasum(GitObject.wrap({ type, object }))
    assert.strictEqual(oid, '7fb539a8e8488c3fd2793e7dda8a44693e25cce1')
  })
})

