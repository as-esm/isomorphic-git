import { test } from 'node:test'
import assert from 'node:assert'
import { init, findRoot } from 'isomorphic-git'
import { makeFixture } from './helpers/fixture.ts'
import { join } from '../src/utils/join.ts'

test('simple operations', async (t) => {
  await t.test('init creates repository', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    
    // Initialize a new repository
    await init({ fs, dir })
    
    const gitdir = join(dir, '.git')
    // Verify gitdir exists
    const exists = await fs.exists(gitdir)
    assert.strictEqual(exists, true)
    
    // Verify config exists
    const configExists = await fs.exists(join(gitdir, 'config'))
    assert.strictEqual(configExists, true)
  })

  await t.test('findRoot finds git directory', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-simple')
    
    // Create .git directory in the working directory so findRoot can find it
    await fs.mkdir(join(dir, '.git'))
    
    const foundRoot = await findRoot({ fs, filepath: dir })
    // findRoot returns the directory containing .git, not the .git directory itself
    assert.strictEqual(foundRoot, dir)
  })

  await t.test('findRoot finds git directory from subdirectory', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-simple')
    
    // Create .git directory in the working directory
    await fs.mkdir(join(dir, '.git'))
    
    // Create a subdirectory
    const subdir = join(dir, 'subdir')
    await fs.mkdir(subdir)
    
    const foundRoot = await findRoot({ fs, filepath: subdir })
    // findRoot should find the directory containing .git
    assert.strictEqual(foundRoot, dir)
  })
})

