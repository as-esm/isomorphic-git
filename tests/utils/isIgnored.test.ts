import { describe, it } from 'node:test'
import assert from 'node:assert'
import { isIgnored } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

// NOTE: we cannot actually commit a real .gitignore file in fixtures or fixtures won't be included in this repo
const writeGitIgnore = async (fs, dir, patterns) =>
  fs.write(dir + '/.gitignore', patterns.join('\n'))

describe('isIgnored', () => {
  it('should check .gitignore', async () => {
    // Setup
    const { fs, gitdir, dir } = await makeFixture('test-isIgnored')
    await writeGitIgnore(fs, dir, ['a.txt', 'c/*', '!c/d.txt', 'd/'])
    // Test
    assert.strictEqual(await isIgnored({ fs, gitdir, dir, filepath: 'a.txt' }), true)
    assert.strictEqual(await isIgnored({ fs, gitdir, dir, filepath: 'b.txt' }), false)
    assert.strictEqual(await isIgnored({ fs, gitdir, dir, filepath: 'c/d.txt' }), false)
    assert.strictEqual(await isIgnored({ fs, gitdir, dir, filepath: 'c/e.txt' }), true)
    assert.strictEqual(await isIgnored({ fs, gitdir, dir, filepath: 'd/' }), true)
  })
  
  it('should check .gitignore in sub directory', async () => {
    // Setup
    const { fs, gitdir, dir } = await makeFixture('test-isIgnored')
    await writeGitIgnore(fs, dir, ['a.txt'])
    await writeGitIgnore(fs, dir + '/c', ['d.txt'])
    // Test
    assert.strictEqual(await isIgnored({ fs, gitdir, dir, filepath: 'a.txt' }), true)
    assert.strictEqual(await isIgnored({ fs, gitdir, dir, filepath: 'b.txt' }), false)
    assert.strictEqual(await isIgnored({ fs, gitdir, dir, filepath: 'c/d.txt' }), true)
    assert.strictEqual(await isIgnored({ fs, gitdir, dir, filepath: 'c/e.txt' }), false)
  })
})

