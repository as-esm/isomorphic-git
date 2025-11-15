import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  add,
  checkout,
  commit,
  status,
  setConfig,
} from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'
import { analyzeCheckout, executeCheckout } from '../../src/core-utils/filesystem/WorkdirManager.ts'

describe('checkout flow', () => {
  const addUserConfig = async (fs: any, dir: string, gitdir: string) => {
    await setConfig({ fs, dir, gitdir, path: 'user.name', value: 'test user' })
    await setConfig({ fs, dir, gitdir, path: 'user.email', value: 'test@example.com' })
  }

  it('should restore files to HEAD when force checkout is used', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-stash')
    await addUserConfig(fs, dir, gitdir)
    
    // Get original content
    const originalContent = await fs.read(`${dir}/a.txt`)
    
    // Make changes to file
    await fs.write(`${dir}/a.txt`, 'modified content')
    
    // Verify file is modified
    const modifiedContent = await fs.read(`${dir}/a.txt`)
    assert.strictEqual(modifiedContent.toString(), 'modified content')
    
    // Checkout with force should restore to HEAD
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'HEAD',
      force: true,
    })
    
    // Verify file is restored
    const restoredContent = await fs.read(`${dir}/a.txt`)
    assert.strictEqual(restoredContent.toString(), originalContent.toString())
  })

  it('should create update operations when workdir differs from HEAD', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-stash')
    await addUserConfig(fs, dir, gitdir)
    
    // Get HEAD tree OID - use readCommit from isomorphic-git
    const { readCommit, resolveRef } = await import('isomorphic-git')
    const headOid = await resolveRef({ fs, gitdir, ref: 'HEAD' })
    const commitResult = await readCommit({ fs, gitdir, oid: headOid })
    const treeOid = commitResult.commit.tree
    assert.ok(treeOid, 'treeOid should be defined')
    assert.strictEqual(typeof treeOid, 'string')
    assert.strictEqual(treeOid.length, 40)
    
    // Make changes to file
    await fs.write(`${dir}/a.txt`, 'modified content')
    
    // Analyze checkout - should detect the change
    const operations = await analyzeCheckout({
      fs,
      dir,
      gitdir,
      treeOid,
      force: true,
    })
    
    // Should have an update operation for a.txt
    const updateOp = operations.find(op => op[0] === 'update' && op[1] === 'a.txt')
    assert.ok(updateOp, 'Should have update operation for a.txt')
  })

  it('should execute checkout operations correctly', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-stash')
    await addUserConfig(fs, dir, gitdir)
    
    // Get original content
    const originalContent = await fs.read(`${dir}/a.txt`)
    
    // Get HEAD tree OID - use readCommit from isomorphic-git
    const { readCommit, resolveRef } = await import('isomorphic-git')
    const headOid = await resolveRef({ fs, gitdir, ref: 'HEAD' })
    const commitResult = await readCommit({ fs, gitdir, oid: headOid })
    const treeOid = commitResult.commit.tree
    assert.ok(treeOid, 'treeOid should be defined')
    assert.strictEqual(typeof treeOid, 'string')
    assert.strictEqual(treeOid.length, 40)
    
    // Make changes to file
    await fs.write(`${dir}/a.txt`, 'modified content')
    
    // Analyze and execute checkout
    const operations = await analyzeCheckout({
      fs,
      dir,
      gitdir,
      treeOid,
      force: true,
    })
    
    await executeCheckout({
      fs,
      dir,
      gitdir,
      operations,
    })
    
    // Verify file is restored
    const restoredContent = await fs.read(`${dir}/a.txt`)
    assert.strictEqual(restoredContent.toString(), originalContent.toString())
  })

  it('should work with cache for checkout operations', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-stash')
    await addUserConfig(fs, dir, gitdir)
    
    // Use a shared cache
    const cache = {}
    
    // Get original content
    const originalContent = await fs.read(`${dir}/a.txt`)
    
    // Make changes and stage them
    await fs.write(`${dir}/a.txt`, 'staged changes')
    await add({ fs, dir, gitdir, filepath: 'a.txt', cache })
    
    // Now checkout with force should restore to HEAD
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'HEAD',
      force: true,
      cache,
    })
    
    // Verify file is restored
    const restoredContent = await fs.read(`${dir}/a.txt`)
    assert.strictEqual(restoredContent.toString(), originalContent.toString())
    
    // Verify status shows file is unmodified
    const fileStatus = await status({ fs, dir, gitdir, filepath: 'a.txt', cache })
    assert.strictEqual(fileStatus, 'unmodified')
  })
})

