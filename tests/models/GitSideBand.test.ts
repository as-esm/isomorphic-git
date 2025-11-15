import { describe, it } from 'node:test'
import assert from 'node:assert'
import { collect } from '../../src/utils/collect.ts'
import { GitSideBand } from '../../src/models/GitSideBand.ts'

describe('GitSideBand', () => {
  it('demux - packetlines, packfile, and progress', async () => {
    const data = `001e# service=git-upload-pack
003dfb74ea1a9b6a9601df18c38d3de751c51f064bf7 refs/heads/main
000e\x01packfile
000e\x02hi there
0000`
    const expectedPacketlines = []
    const expectedProgress = []
    const expectedPackfile = []
    const lines = data.split(/\n/)
    const lastLineIdx = lines.length - 1
    lines.forEach((it, idx) => {
      it = it.slice(4) + (idx === lastLineIdx ? '' : '\n')
      if (it.startsWith('\x01')) {
        expectedPackfile.push(it.slice(1))
      } else if (it.startsWith('\x02')) {
        expectedProgress.push(it.slice(1))
      } else {
        expectedPacketlines.push(it)
      }
    })
    const stream = [Buffer.from(data)]
    const { packetlines, packfile, progress } = GitSideBand.demux(stream)
    const collectedPacketlines = await collect(packetlines)
    const collectedProgress = await collect(progress)
    const collectedPackfile = await collect(packfile)
    assert.strictEqual(collectedPacketlines.length > 0, true)
    assert.strictEqual(Buffer.from(collectedPacketlines).toString(), expectedPacketlines.join(''))
    assert.strictEqual(collectedProgress.length > 0, true)
    assert.strictEqual(Buffer.from(collectedProgress).toString(), expectedProgress.join(''))
    assert.strictEqual(collectedPackfile.length > 0, true)
    assert.strictEqual(Buffer.from(collectedPackfile).toString(), expectedPackfile.join(''))
  })

  it('demux - error line', async () => {
    const data = `001e# service=git-upload-pack
0015\x03error in stream
0000`
    const expectedPacketlines = []
    const expectedProgress = []
    const lines = data.split(/\n/)
    const lastLineIdx = lines.length - 1
    lines.forEach((it, idx) => {
      it = it.slice(4) + (idx === lastLineIdx ? '' : '\n')
      if (it.startsWith('\x03')) {
        expectedProgress.push(it.slice(1))
      } else {
        expectedPacketlines.push(it)
      }
    })
    const stream = [Buffer.from(data)]
    const { packetlines, packfile, progress } = GitSideBand.demux(stream)
    const collectedPacketlines = await collect(packetlines)
    const collectedProgress = await collect(progress)
    const collectedPackfile = await collect(packfile)
    assert.strictEqual(collectedPacketlines.length > 0, true)
    assert.strictEqual(Buffer.from(collectedPacketlines).toString(), expectedPacketlines.join(''))
    assert.strictEqual(collectedProgress.length > 0, true)
    assert.strictEqual(Buffer.from(collectedProgress).toString(), expectedProgress.join(''))
    assert.strictEqual(collectedPackfile.length === 0, true)
    assert.strictEqual('error' in packfile, true)
    assert.strictEqual(packfile.error.message, 'error in stream\n')
  })
})

