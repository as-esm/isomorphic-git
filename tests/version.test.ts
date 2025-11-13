import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { version } from 'isomorphic-git'

/**
 * @todo Use `import ... with { type: 'json' }` when development uses Node.js 20+.
 * Note this needs Eslint 9
 */
const pkg = JSON.parse(
  readFileSync(
    join(fileURLToPath(import.meta.url), '../../package.json'),
    'utf8'
  )
)

test('version', async (t) => {
  await t.test('version', () => {
    const v = version()
    assert.strictEqual(v, pkg.version)
  })
})

