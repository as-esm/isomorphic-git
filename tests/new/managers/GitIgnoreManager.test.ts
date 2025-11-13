import { test } from 'node:test'
import assert from 'node:assert'
import { GitIgnoreManager } from '../../../src/managers/GitIgnoreManager.ts'
import { makeFixture } from '../../helpers/fixture.ts'
import * as path from 'path'

test('GitIgnoreManager', async (t) => {
  await t.test('isIgnored returns false for non-ignored files', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-isIgnored')
    
    const ignored = await GitIgnoreManager.isIgnored({
      fs,
      dir,
      gitdir,
      filepath: 'test.txt',
    })
    
    assert.strictEqual(ignored, false)
  })

  await t.test('isIgnored returns true for ignored files', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-isIgnored')
    
    // Create a .gitignore file
    await fs.write(path.join(dir, '.gitignore'), '*.log\nnode_modules/\n', 'utf8')
    
    const ignored = await GitIgnoreManager.isIgnored({
      fs,
      dir,
      gitdir,
      filepath: 'test.log',
    })
    
    assert.strictEqual(ignored, true)
  })

  await t.test('always ignores .git folders', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-isIgnored')
    
    const ignored = await GitIgnoreManager.isIgnored({
      fs,
      dir,
      gitdir,
      filepath: '.git',
    })
    
    assert.strictEqual(ignored, true)
  })

  await t.test('never ignores root directory', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-isIgnored')
    
    const ignored = await GitIgnoreManager.isIgnored({
      fs,
      dir,
      gitdir,
      filepath: '.',
    })
    
    assert.strictEqual(ignored, false)
  })

  await t.test('respects parent directory exclusion', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-isIgnored')
    
    // Create .gitignore that excludes a directory
    await fs.write(path.join(dir, '.gitignore'), 'excluded/\n', 'utf8')
    
    // Even if we try to un-ignore a file in excluded directory, it should still be ignored
    await fs.write(path.join(dir, 'excluded', '.gitignore'), '!file.txt\n', 'utf8')
    
    const ignored = await GitIgnoreManager.isIgnored({
      fs,
      dir,
      gitdir,
      filepath: 'excluded/file.txt',
    })
    
    assert.strictEqual(ignored, true)
  })
})

