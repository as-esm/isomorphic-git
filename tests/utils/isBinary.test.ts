import { test } from 'node:test'
import assert from 'node:assert'
import * as path from 'path'
import { isBinary } from '../../src/utils/isBinary.ts'
import { makeFixture } from '../helpers/fixture.ts'

const binaryFiles = [
  'browserconfig.gz',
  'browserconfig.zip',
  'favicon-16x16.gif',
  'favicon-16x16.png',
]
const textFiles = ['browserconfig.xml', 'manifest.json']

test('isBinary', async (t) => {
  for (const file of binaryFiles) {
    await t.test(`${path.extname(file)} is binary`, async () => {
      // Setup
      const { fs, dir } = await makeFixture('test-isBinary')
      const buffer = await fs.read(`${dir}/${file}`)
      // Test
      assert.strictEqual(isBinary(buffer), true)
    })
  }

  for (const file of textFiles) {
    await t.test(`${path.extname(file)} is NOT binary`, async () => {
      // Setup
      const { fs, dir } = await makeFixture('test-isBinary')
      const buffer = await fs.read(`${dir}/${file}`)
      // Test
      assert.strictEqual(isBinary(buffer), false)
    })
  }
})

