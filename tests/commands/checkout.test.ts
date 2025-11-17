import { test } from 'node:test'
import assert from 'node:assert'
import {
  Errors,
  checkout,
  listFiles,
  add,
  commit,
  branch,
  getConfig,
} from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'
import { readLog } from '../../src/git/logs/readLog.ts'

test('checkout', async (t) => {
  await t.test('checkout branch', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')
    const onPostCheckout: any[] = []
    
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'test-branch',
      onPostCheckout: (args) => {
        onPostCheckout.push(args)
      },
    })
    
    const files = await fs.readdir(dir)
    assert.ok(files.includes('.babelrc'), 'Should have .babelrc')
    assert.ok(files.includes('src'), 'Should have src directory')
    assert.ok(files.includes('test'), 'Should have test directory')
    
    const index = await listFiles({ fs, dir, gitdir })
    assert.ok(index.length > 0, 'Should have files in index')
    assert.ok(index.includes('src/commands/checkout.js'), 'Should have checkout.js')
    
    const sha = await fs.read(`${gitdir}/HEAD`, 'utf8')
    assert.strictEqual(sha, 'ref: refs/heads/test-branch\n', 'HEAD should point to test-branch')
    
    assert.strictEqual(onPostCheckout.length, 1, 'onPostCheckout should be called once')
    assert.strictEqual(onPostCheckout[0].newHead, 'e10ebb90d03eaacca84de1af0a59b444232da99e', 'newHead should match')
    assert.strictEqual(onPostCheckout[0].previousHead, '0f55956cbd50de80c2f86e6e565f00c92ce86631', 'previousHead should match')
    assert.strictEqual(onPostCheckout[0].type, 'branch', 'type should be branch')
    
    // Verify HEAD reflog entry was created
    const headReflogEntries = await readLog({ fs, gitdir, ref: 'HEAD', parsed: true })
    assert.ok(headReflogEntries.length > 0, 'HEAD reflog should have at least one entry')
    const lastHeadEntry = headReflogEntries[headReflogEntries.length - 1] as { oldOid: string; newOid: string; message: string }
    assert.strictEqual(lastHeadEntry.oldOid, '0f55956cbd50de80c2f86e6e565f00c92ce86631')
    assert.strictEqual(lastHeadEntry.newOid, 'e10ebb90d03eaacca84de1af0a59b444232da99e')
    assert.ok(lastHeadEntry.message.includes('checkout'), 'HEAD reflog message should contain checkout')
  })

  await t.test('checkout by tag', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')
    
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'v1.0.0',
    })
    
    const files = await fs.readdir(dir)
    assert.ok(files.includes('src'), 'Should have src directory')
    
    const sha = await fs.read(`${gitdir}/HEAD`, 'utf8')
    assert.strictEqual(sha, 'e10ebb90d03eaacca84de1af0a59b444232da99e\n', 'HEAD should point to tag commit')
  })

  await t.test('checkout by SHA', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')
    
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'e10ebb90d03eaacca84de1af0a59b444232da99e',
    })
    
    const files = await fs.readdir(dir)
    assert.ok(files.includes('src'), 'Should have src directory')
    
    const sha = await fs.read(`${gitdir}/HEAD`, 'utf8')
    assert.strictEqual(sha, 'e10ebb90d03eaacca84de1af0a59b444232da99e\n', 'HEAD should point to SHA')
  })

  await t.test('checkout unfetched branch', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')
    
    let error: unknown = null
    try {
      await checkout({ fs, dir, gitdir, ref: 'missing-branch' })
      assert.fail('Checkout should have failed')
    } catch (err) {
      error = err
    }
    
    assert.ok(error, 'Error should be defined')
    assert.ok(error instanceof Errors.CommitNotFetchedError, 'Should throw CommitNotFetchedError')
    if (error instanceof Errors.CommitNotFetchedError) {
      assert.strictEqual(error.code, 'CommitNotFetchedError', 'Error code should match')
      assert.strictEqual(error.data.ref, 'missing-branch', 'Ref should match')
      assert.strictEqual(error.data.oid, '033417ae18b174f078f2f44232cb7a374f4c60ce', 'OID should match')
    }
  })

  await t.test('checkout file permissions', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')
    
    await branch({ fs, dir, gitdir, ref: 'other', checkout: true })
    
    // Verify branch creation reflog
    const branchReflogEntries = await readLog({ fs, gitdir, ref: 'refs/heads/other', parsed: true })
    assert.ok(branchReflogEntries.length > 0, 'Branch reflog should have at least one entry')
    const branchEntry = branchReflogEntries[branchReflogEntries.length - 1] as { message: string }
    assert.ok(branchEntry.message.includes('branch'), 'Branch reflog message should contain branch')
    
    await checkout({ fs, dir, gitdir, ref: 'test-branch' })
    
    await fs.write(`${dir}/regular-file.txt`, 'regular file', { mode: 0o666 })
    await fs.write(`${dir}/executable-file.sh`, 'executable file', { mode: 0o777 })
    
    const expectedRegularFileMode = (await fs.lstat(`${dir}/regular-file.txt`)).mode
    const expectedExecutableFileMode = (await fs.lstat(`${dir}/executable-file.sh`)).mode
    
    await add({ fs, dir, gitdir, filepath: 'regular-file.txt' })
    await add({ fs, dir, gitdir, filepath: 'executable-file.sh' })
    await commit({
      fs,
      dir,
      gitdir,
      author: { name: 'Git', email: 'git@example.org' },
      message: 'add files',
    })
    
    await checkout({ fs, dir, gitdir, ref: 'other' })
    await checkout({ fs, dir, gitdir, ref: 'test-branch' })
    
    const actualRegularFileMode = (await fs.lstat(`${dir}/regular-file.txt`)).mode
    const actualExecutableFileMode = (await fs.lstat(`${dir}/executable-file.sh`)).mode
    
    assert.strictEqual(actualRegularFileMode, expectedRegularFileMode, 'Regular file mode should be preserved')
    assert.strictEqual(actualExecutableFileMode, expectedExecutableFileMode, 'Executable file mode should be preserved')
  })

  await t.test('checkout changing file permissions', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')

    await fs.write(`${dir}/regular-file.txt`, 'regular file', { mode: 0o666 })
    await fs.write(`${dir}/executable-file.sh`, 'executable file', { mode: 0o777 })
    
    const { mode: expectedRegularFileMode } = await fs.lstat(`${dir}/regular-file.txt`)
    const { mode: expectedExecutableFileMode } = await fs.lstat(`${dir}/executable-file.sh`)

    await checkout({ fs, dir, gitdir, ref: 'regular-file' })
    const { mode: actualRegularFileMode } = await fs.lstat(`${dir}/hello.sh`)
    assert.strictEqual(actualRegularFileMode, expectedRegularFileMode, 'File mode should match')

    await checkout({ fs, dir, gitdir, ref: 'executable-file' })
    const { mode: actualExecutableFileMode } = await fs.lstat(`${dir}/hello.sh`)
    assert.strictEqual(actualExecutableFileMode, expectedExecutableFileMode, 'Executable mode should match')
  })

  await t.test('checkout directories using filepaths', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')
    
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'test-branch',
      filepaths: ['src/models', 'test'],
    })
    
    const files = await fs.readdir(dir)
    assert.ok(files.includes('src'), 'Should have src directory')
    assert.ok(files.includes('test'), 'Should have test directory')
    assert.strictEqual(files.length, 2, 'Should only have src and test')
    
    const index = await listFiles({ fs, dir, gitdir })
    assert.ok(index.includes('src/models/GitBlob.js'), 'Should have GitBlob.js')
    assert.ok(index.includes('test/resolveRef.js'), 'Should have resolveRef.js')
  })

  await t.test('checkout files using filepaths', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')
    
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'test-branch',
      filepaths: ['src/models/GitBlob.js', 'src/utils/write.js'],
    })
    
    const files = await fs.readdir(dir)
    assert.ok(files.includes('src'), 'Should have src directory')
    assert.strictEqual(files.length, 1, 'Should only have src')
    
    const index = await listFiles({ fs, dir, gitdir })
    assert.ok(index.includes('src/models/GitBlob.js'), 'Should have GitBlob.js')
    assert.ok(index.includes('src/utils/write.js'), 'Should have write.js')
  })

  await t.test('checkout detects conflicts', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')
    
    await fs.write(`${dir}/README.md`, 'Hello world', 'utf8')
    
    let error: unknown = null
    try {
      await checkout({
        fs,
        dir,
        gitdir,
        ref: 'test-branch',
      })
    } catch (e) {
      error = e
    }
    
    assert.ok(error, 'Error should be defined')
    assert.ok(error instanceof Errors.CheckoutConflictError, 'Should throw CheckoutConflictError')
    if (error instanceof Errors.CheckoutConflictError) {
      assert.ok(error.data.filepaths.includes('README.md'), 'Should include README.md in conflicts')
    }
  })

  await t.test('checkout files ignoring conflicts dry run', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')
    
    await fs.write(`${dir}/README.md`, 'Hello world', 'utf8')
    
    let error: unknown = null
    try {
      await checkout({
        fs,
        dir,
        gitdir,
        ref: 'test-branch',
        force: true,
        dryRun: true,
      })
    } catch (e) {
      error = e
    }
    
    assert.strictEqual(error, null, 'Should not throw error with force and dryRun')
    const content = await fs.read(`${dir}/README.md`, 'utf8')
    assert.strictEqual(content, 'Hello world', 'File should not be changed in dry run')
  })

  await t.test('checkout files ignoring conflicts', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')
    
    await fs.write(`${dir}/README.md`, 'Hello world', 'utf8')
    
    let error: unknown = null
    try {
      await checkout({
        fs,
        dir,
        gitdir,
        ref: 'test-branch',
        force: true,
      })
    } catch (e) {
      error = e
    }
    
    assert.strictEqual(error, null, 'Should not throw error with force')
    const content = await fs.read(`${dir}/README.md`, 'utf8')
    assert.notStrictEqual(content, 'Hello world', 'File should be changed when force is true')
  })

  await t.test('restore files to HEAD state by not providing a ref', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')
    
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'test-branch',
    })
    
    await fs.write(`${dir}/README.md`, 'Hello world', 'utf8')
    
    let error: unknown = null
    try {
      await checkout({
        fs,
        dir,
        gitdir,
        force: true,
      })
    } catch (e) {
      error = e
    }
    
    assert.strictEqual(error, null, 'Should not throw error')
    const content = await fs.read(`${dir}/README.md`, 'utf8')
    assert.notStrictEqual(content, 'Hello world', 'File should be restored to HEAD')
  })

  await t.test('checkout files should not delete other files', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')
    
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'test-branch',
    })
    
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'test-branch',
      filepaths: ['src/utils', 'test'],
    })
    
    const files = await fs.readdir(dir)
    assert.ok(files.includes('README.md'), 'README.md should still exist')
  })

  await t.test('onPostCheckout dry run', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')
    const onPostCheckout: any[] = []
    
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'test-branch',
      dryRun: true,
      onPostCheckout: (args) => {
        onPostCheckout.push(args)
      },
    })

    assert.strictEqual(onPostCheckout.length, 1, 'onPostCheckout should be called once')
    assert.strictEqual(onPostCheckout[0].newHead, 'e10ebb90d03eaacca84de1af0a59b444232da99e', 'newHead should match')
    assert.strictEqual(onPostCheckout[0].previousHead, '0f55956cbd50de80c2f86e6e565f00c92ce86631', 'previousHead should match')
    assert.strictEqual(onPostCheckout[0].type, 'branch', 'type should be branch')
  })

  await t.test('onPostCheckout with specified filepaths', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')
    
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'test-branch',
    })
    
    const onPostCheckout: any[] = []
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'test-branch',
      filepaths: ['src/utils', 'test'],
      onPostCheckout: (args) => {
        onPostCheckout.push(args)
      },
    })

    assert.strictEqual(onPostCheckout.length, 1, 'onPostCheckout should be called once')
    assert.strictEqual(onPostCheckout[0].newHead, 'e10ebb90d03eaacca84de1af0a59b444232da99e', 'newHead should match')
    assert.strictEqual(onPostCheckout[0].previousHead, 'e10ebb90d03eaacca84de1af0a59b444232da99e', 'previousHead should match (same commit)')
    assert.strictEqual(onPostCheckout[0].type, 'file', 'type should be file when filepaths are specified')
  })

  await t.test('checkout should not delete ignored files', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-checkout')

    // Checkout the test-branch
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'test-branch',
    })

    // Create a branch from test-branch
    await branch({
      fs,
      dir,
      gitdir,
      ref: 'branch-w-ignored-dir',
      checkout: true,
    })
    
    // Add a regular file to the ignored dir
    await fs.write(`${dir}/ignored/regular-file.txt`, 'regular file', { mode: 0o666 })

    // Add and commit a gitignore, ignoring everything but itself
    const gitignoreContent = `*
!.gitignore`
    await fs.write(`${dir}/ignored/.gitignore`, gitignoreContent, { mode: 0o666 })
    await add({ fs, dir, gitdir, filepath: 'ignored/.gitignore' })

    await commit({
      fs,
      dir,
      gitdir,
      author: { name: 'Git', email: 'git@example.org' },
      message: 'add gitignore',
    })

    // Checkout the test-branch, which does not contain the ignore/.gitignore
    // should not delete files from ignore, but leave them as untracked in the working tree
    await checkout({
      fs,
      dir,
      gitdir,
      ref: 'test-branch',
    })
    
    const files = await fs.readdir(`${dir}/ignored`)
    assert.ok(files.includes('regular-file.txt'), 'regular-file.txt should still exist')
    assert.strictEqual(files.includes('.gitignore'), false, '.gitignore should be removed (was tracked)')
  })
})

