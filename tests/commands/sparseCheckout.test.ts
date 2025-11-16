import { test } from 'node:test'
import assert from 'node:assert'
import {
  init,
  add,
  commit,
  sparseCheckout,
  checkout,
  listFiles,
  readBlob,
} from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'
import { join } from '../../src/utils/join.ts'
import { ConfigAccess } from '../../src/utils/configAccess.ts'

test('sparse checkout cone mode', async (t) => {
  await t.test('initialize sparse checkout with cone mode', async () => {
    // CRITICAL: Clear Repository cache at the start to ensure test isolation
    const { Repository } = await import('../../src/core-utils/Repository.ts')
    Repository.clearInstanceCache()
    
    const { fs, dir, gitdir } = await makeFixture('test-sparse-checkout-init')
    
    // CRITICAL: Create Repository instance ONCE to manage state consistently
    const cache = {}
    const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
    
    // Initialize repository
    await init({ fs, dir })
    
    // Create initial commit with multiple directories
    await fs.write(join(dir, 'src', 'file1.txt'), 'content1')
    await fs.write(join(dir, 'src', 'file2.txt'), 'content2')
    await fs.write(join(dir, 'docs', 'readme.md'), 'docs content')
    await fs.write(join(dir, 'tests', 'test.js'), 'test content')
    await fs.write(join(dir, 'root.txt'), 'root content')
    
    await add({ fs, dir, gitdir, filepath: '.', cache })
    await commit({ fs, dir, gitdir, message: 'Initial commit', author: { name: 'Test', email: 'test@test.com' }, cache })
    
    // Initialize sparse checkout with cone mode
    await sparseCheckout({ fs, dir, gitdir, init: true, cone: true, cache })
    
    // FIX: Reload the Repository to get fresh config state after sparseCheckout modifies it
    // sparseCheckout creates its own Repository instance, so we need to reload to see the changes
    const repoAfter = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
    const configService = await repoAfter.getConfig()
    // Force reload to ensure we have the latest config from disk
    await configService.reload()
    const sparseCheckoutEnabled = await configService.get('core.sparseCheckout')
    const coneModeEnabled = await configService.get('core.sparseCheckoutCone')
    
    // ConfigParser may convert 'true' strings to boolean true, so check for both
    assert.ok(sparseCheckoutEnabled === 'true' || sparseCheckoutEnabled === true, `Expected 'true' or true, got ${sparseCheckoutEnabled}`)
    assert.ok(coneModeEnabled === 'true' || coneModeEnabled === true, `Expected 'true' or true, got ${coneModeEnabled}`)
    
    // Verify sparse-checkout file exists
    const sparseCheckoutFile = join(gitdir, 'info', 'sparse-checkout')
    const fileExists = await fs.exists(sparseCheckoutFile)
    assert.strictEqual(fileExists, true)
    
    // Verify default pattern (everything)
    const patterns = await sparseCheckout({ fs, dir, gitdir, list: true, cache })
    assert.ok(patterns && patterns.length > 0)
  })

  await t.test('set patterns in cone mode and verify checkout', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-sparse-checkout-cone')
    
    // Initialize repository
    await init({ fs, dir })
    
    // Create directory structure
    await fs.write(join(dir, 'src', 'main', 'app.js'), 'app content')
    await fs.write(join(dir, 'src', 'utils', 'helper.js'), 'helper content')
    await fs.write(join(dir, 'src', 'file.txt'), 'file content')
    await fs.write(join(dir, 'docs', 'readme.md'), 'docs content')
    await fs.write(join(dir, 'tests', 'test.js'), 'test content')
    await fs.write(join(dir, 'config.json'), 'config content')
    
    await add({ fs, dir, filepath: '.' })
    await commit({ fs, dir, message: 'Initial commit', author: { name: 'Test', email: 'test@test.com' } })
    
    // Initialize sparse checkout with cone mode
    await sparseCheckout({ fs, dir, init: true, cone: true })
    
    // Set pattern to only include src/ directory
    await sparseCheckout({ fs, dir, set: ['src/'], cone: true })
    
    // Checkout to apply sparse patterns
    await checkout({ fs, dir, ref: 'HEAD' })
    
    // Verify only src/ files are checked out
    const files = await listFiles({ fs, dir })
    
    // Should include src/ files
    assert.ok(files.includes('src/main/app.js'))
    assert.ok(files.includes('src/utils/helper.js'))
    assert.ok(files.includes('src/file.txt'))
    
    // Should NOT include other directories
    assert.ok(!files.includes('docs/readme.md'))
    assert.ok(!files.includes('tests/test.js'))
    // Root files might still be there depending on implementation
  })

  await t.test('cone mode with multiple directory patterns', async () => {
    const { fs, dir } = await makeFixture('test-sparse-checkout-multi-cone')
    
    await init({ fs, dir })
    
    // Create files in multiple directories
    await fs.write(join(dir, 'src', 'app.js'), 'app')
    await fs.write(join(dir, 'docs', 'readme.md'), 'readme')
    await fs.write(join(dir, 'tests', 'test.js'), 'test')
    await fs.write(join(dir, 'lib', 'util.js'), 'util')
    await fs.write(join(dir, 'other', 'file.txt'), 'other')
    
    await add({ fs, dir, filepath: '.' })
    await commit({ fs, dir, message: 'Initial', author: { name: 'Test', email: 'test@test.com' } })
    
    await sparseCheckout({ fs, dir, init: true, cone: true })
    
    // Set patterns to include both src/ and docs/
    await sparseCheckout({ fs, dir, set: ['src/', 'docs/'], cone: true })
    
    await checkout({ fs, dir, ref: 'HEAD' })
    
    const files = await listFiles({ fs, dir })
    
    // Should include src/ and docs/ files
    assert.ok(files.includes('src/app.js'))
    assert.ok(files.includes('docs/readme.md'))
    
    // Should NOT include other directories
    assert.ok(!files.includes('tests/test.js'))
    assert.ok(!files.includes('lib/util.js'))
    assert.ok(!files.includes('other/file.txt'))
  })

  await t.test('cone mode pattern matching - nested directories', async () => {
    const { fs, dir } = await makeFixture('test-sparse-checkout-nested')
    
    await init({ fs, dir })
    
    // Create nested structure
    await fs.write(join(dir, 'src', 'main', 'deep', 'file.js'), 'deep file')
    await fs.write(join(dir, 'src', 'main', 'file.js'), 'main file')
    await fs.write(join(dir, 'src', 'other', 'file.js'), 'other file')
    await fs.write(join(dir, 'docs', 'api', 'index.md'), 'api docs')
    
    await add({ fs, dir, filepath: '.' })
    await commit({ fs, dir, message: 'Initial', author: { name: 'Test', email: 'test@test.com' } })
    
    await sparseCheckout({ fs, dir, init: true, cone: true })
    
    // Set pattern to src/main/ - should include all nested files
    await sparseCheckout({ fs, dir, set: ['src/main/'], cone: true })
    
    await checkout({ fs, dir, ref: 'HEAD' })
    
    const files = await listFiles({ fs, dir })
    
    // Should include all files under src/main/
    assert.ok(files.includes('src/main/file.js'))
    assert.ok(files.includes('src/main/deep/file.js'))
    
    // Should NOT include other directories
    assert.ok(!files.includes('src/other/file.js'))
    assert.ok(!files.includes('docs/api/index.md'))
  })

  await t.test('cone mode vs non-cone mode behavior', async () => {
    // CRITICAL: Clear Repository cache at the start to ensure test isolation
    // This prevents interference from other parallel tests
    const { Repository } = await import('../../src/core-utils/Repository.ts')
    Repository.clearInstanceCache()
    
    const { fs, dir, gitdir } = await makeFixture('test-sparse-checkout-modes')
    
    // CRITICAL: Create the Repository instance ONCE at the start to ensure all operations
    // use the same Repository context. This prevents HEAD resolution issues.
    const cache = {}
    const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
    
    await init({ fs, dir })
    
    // Create files with pattern that works differently in cone vs non-cone
    await fs.write(join(dir, 'src', 'file.js'), 'src file')
    await fs.write(join(dir, 'src-backup', 'file.js'), 'backup file')
    await fs.write(join(dir, 'docs', 'readme.md'), 'docs')
    
    // Use the same cache to ensure Repository instance consistency
    await add({ fs, dir, gitdir, filepath: '.', cache })
    await commit({ fs, dir, gitdir, message: 'Initial', author: { name: 'Test', email: 'test@test.com' }, cache })
    
    // Test cone mode: pattern 'src/' should only match src/ directory
    // Note: sparseCheckout already calls checkout internally, so we don't need to call it separately
    // Use the same cache to ensure Repository instance consistency
    await sparseCheckout({ fs, dir, gitdir, init: true, cone: true, cache })
    await sparseCheckout({ fs, dir, gitdir, set: ['src/'], cone: true, cache })
    
    // Use the same cache to ensure listFiles sees the updated index
    // Don't clear the cache here - we want listFiles to use the same Repository instance
    let files = await listFiles({ fs, dir, cache })
    assert.ok(files.includes('src/file.js'))
    assert.ok(!files.includes('src-backup/file.js'), 'Cone mode should not match src-backup/')
    
    // Reset and test non-cone mode: pattern 'src/*' might match differently
    await sparseCheckout({ fs, dir, gitdir, init: true, cone: false, cache })
    await sparseCheckout({ fs, dir, gitdir, set: ['src/*'], cone: false, cache })
    
    files = await listFiles({ fs, dir, cache })
    // Non-cone mode with 'src/*' should match files in src/ but not subdirectories
    assert.ok(files.includes('src/file.js'))
  })

  await t.test('list sparse checkout patterns', async () => {
    const { fs, dir } = await makeFixture('test-sparse-checkout-list')
    
    await init({ fs, dir })
    await fs.write(join(dir, 'file.txt'), 'content')
    await add({ fs, dir, filepath: '.' })
    await commit({ fs, dir, message: 'Initial', author: { name: 'Test', email: 'test@test.com' } })
    
    await sparseCheckout({ fs, dir, init: true, cone: true })
    await sparseCheckout({ fs, dir, set: ['src/', 'docs/'], cone: true })
    
    const patterns = await sparseCheckout({ fs, dir, list: true })
    
    assert.ok(Array.isArray(patterns))
    assert.ok(patterns.length >= 2)
    // Patterns should be normalized (with trailing slashes in cone mode)
    assert.ok(patterns.some(p => p.includes('src')))
    assert.ok(patterns.some(p => p.includes('docs')))
  })

  await t.test('cone mode with root-level files', async () => {
    const { fs, dir } = await makeFixture('test-sparse-checkout-root')
    
    await init({ fs, dir })
    
    await fs.write(join(dir, 'package.json'), '{}')
    await fs.write(join(dir, 'README.md'), 'readme')
    await fs.write(join(dir, 'src', 'app.js'), 'app')
    await fs.write(join(dir, 'docs', 'readme.md'), 'docs')
    
    await add({ fs, dir, filepath: '.' })
    await commit({ fs, dir, message: 'Initial', author: { name: 'Test', email: 'test@test.com' } })
    
    await sparseCheckout({ fs, dir, init: true, cone: true })
    
    // In cone mode, patterns are directory-based, so root files behavior may vary
    // Setting pattern to src/ should include src/ but root files might still be there
    await sparseCheckout({ fs, dir, set: ['src/'], cone: true })
    await checkout({ fs, dir, ref: 'HEAD' })
    
    const files = await listFiles({ fs, dir })
    
    // Should definitely include src/ files
    assert.ok(files.includes('src/app.js'))
    
    // Root files might be included or not depending on Git behavior
    // This test documents current behavior
  })

  await t.test('sparse checkout disabled by default', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-sparse-checkout-disabled')
    
    await init({ fs, dir })
    await fs.write(join(dir, 'file.txt'), 'content')
    await add({ fs, dir, filepath: '.' })
    await commit({ fs, dir, message: 'Initial', author: { name: 'Test', email: 'test@test.com' } })
    
    // Don't initialize sparse checkout
    await checkout({ fs, dir, ref: 'HEAD' })
    
    // Verify sparse checkout is not enabled
    const sparseCheckoutFile = join(gitdir, 'info', 'sparse-checkout')
    const exists = await fs.exists(sparseCheckoutFile).catch(() => false)
    assert.strictEqual(exists, false, 'Sparse checkout file should not exist')
    
    // All files should be checked out
    const files = await listFiles({ fs, dir })
    assert.ok(files.includes('file.txt'))
  })

  await t.test('negative patterns (! prefix) in cone mode - exclude subdirectory', async () => {
    const { fs, dir } = await makeFixture('test-sparse-checkout-negative')
    
    await init({ fs, dir })
    
    // Create directory structure with subdirectories
    await fs.write(join(dir, 'src', 'main', 'app.js'), 'app content')
    await fs.write(join(dir, 'src', 'main', 'temp', 'temp.js'), 'temp content')
    await fs.write(join(dir, 'src', 'utils', 'helper.js'), 'helper content')
    await fs.write(join(dir, 'src', 'tests', 'test.js'), 'test content')
    await fs.write(join(dir, 'docs', 'readme.md'), 'docs content')
    
    await add({ fs, dir, filepath: '.' })
    await commit({ fs, dir, message: 'Initial', author: { name: 'Test', email: 'test@test.com' } })
    
    await sparseCheckout({ fs, dir, init: true, cone: true })
    
    // Include src/ but exclude src/tests/ and src/main/temp/
    await sparseCheckout({ fs, dir, set: ['src/', '!src/tests/', '!src/main/temp/'], cone: true })
    
    await checkout({ fs, dir, ref: 'HEAD' })
    
    const files = await listFiles({ fs, dir })
    
    // Should include src/ files
    assert.ok(files.includes('src/main/app.js'))
    assert.ok(files.includes('src/utils/helper.js'))
    
    // Should exclude src/tests/ and src/main/temp/
    assert.ok(!files.includes('src/tests/test.js'), 'src/tests/ should be excluded')
    assert.ok(!files.includes('src/main/temp/temp.js'), 'src/main/temp/ should be excluded')
    
    // Should NOT include docs/ (not in inclusion patterns)
    assert.ok(!files.includes('docs/readme.md'))
  })

  await t.test('negative patterns - exclude nested subdirectory', async () => {
    const { fs, dir } = await makeFixture('test-sparse-checkout-negative-nested')
    
    await init({ fs, dir })
    
    // Create deep nested structure
    await fs.write(join(dir, 'src', 'app', 'core', 'main.js'), 'main')
    await fs.write(join(dir, 'src', 'app', 'core', 'temp', 'temp.js'), 'temp')
    await fs.write(join(dir, 'src', 'app', 'utils', 'helper.js'), 'helper')
    
    await add({ fs, dir, filepath: '.' })
    await commit({ fs, dir, message: 'Initial', author: { name: 'Test', email: 'test@test.com' } })
    
    await sparseCheckout({ fs, dir, init: true, cone: true })
    
    // Include src/app/ but exclude src/app/core/temp/
    await sparseCheckout({ fs, dir, set: ['src/app/', '!src/app/core/temp/'], cone: true })
    
    await checkout({ fs, dir, ref: 'HEAD' })
    
    const files = await listFiles({ fs, dir })
    
    // Should include src/app/ files
    assert.ok(files.includes('src/app/core/main.js'))
    assert.ok(files.includes('src/app/utils/helper.js'))
    
    // Should exclude src/app/core/temp/
    assert.ok(!files.includes('src/app/core/temp/temp.js'))
  })

  await t.test('negative patterns - multiple exclusions', async () => {
    const { fs, dir } = await makeFixture('test-sparse-checkout-multiple-negative')
    
    await init({ fs, dir })
    
    await fs.write(join(dir, 'src', 'file1.js'), 'file1')
    await fs.write(join(dir, 'src', 'temp1', 'file.js'), 'temp1')
    await fs.write(join(dir, 'src', 'temp2', 'file.js'), 'temp2')
    await fs.write(join(dir, 'src', 'main', 'app.js'), 'app')
    
    await add({ fs, dir, filepath: '.' })
    await commit({ fs, dir, message: 'Initial', author: { name: 'Test', email: 'test@test.com' } })
    
    await sparseCheckout({ fs, dir, init: true, cone: true })
    
    // Include src/ but exclude multiple temp directories
    await sparseCheckout({ fs, dir, set: ['src/', '!src/temp1/', '!src/temp2/'], cone: true })
    
    await checkout({ fs, dir, ref: 'HEAD' })
    
    const files = await listFiles({ fs, dir })
    
    // Should include src/ files
    assert.ok(files.includes('src/file1.js'))
    assert.ok(files.includes('src/main/app.js'))
    
    // Should exclude both temp directories
    assert.ok(!files.includes('src/temp1/file.js'))
    assert.ok(!files.includes('src/temp2/file.js'))
  })

  await t.test('negative patterns - exclusion without inclusion should exclude everything', async () => {
    const { fs, dir } = await makeFixture('test-sparse-checkout-negative-only')
    
    await init({ fs, dir })
    
    await fs.write(join(dir, 'src', 'file.js'), 'file')
    await fs.write(join(dir, 'docs', 'readme.md'), 'readme')
    
    await add({ fs, dir, filepath: '.' })
    await commit({ fs, dir, message: 'Initial', author: { name: 'Test', email: 'test@test.com' } })
    
    await sparseCheckout({ fs, dir, init: true, cone: true })
    
    // Only exclusion patterns, no inclusion patterns
    // This should result in nothing being included
    await sparseCheckout({ fs, dir, set: ['!src/'], cone: true })
    
    await checkout({ fs, dir, ref: 'HEAD' })
    
    const files = await listFiles({ fs, dir })
    
    // With no inclusion patterns, nothing should be checked out
    // (This tests the behavior when only exclusions are provided)
    assert.ok(!files.includes('src/file.js'))
    assert.ok(!files.includes('docs/readme.md'))
  })

  await t.test('negative patterns - preserve ! prefix in file', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-sparse-checkout-negative-file')
    
    await init({ fs, dir })
    await fs.write(join(dir, 'file.txt'), 'content')
    await add({ fs, dir, filepath: '.' })
    await commit({ fs, dir, message: 'Initial', author: { name: 'Test', email: 'test@test.com' } })
    
    await sparseCheckout({ fs, dir, gitdir, init: true, cone: true })
    
    // Set patterns with negative patterns
    await sparseCheckout({ fs, dir, gitdir, set: ['src/', '!src/temp/'], cone: true })
    
    // Verify the sparse-checkout file contains the ! prefix
    const sparseCheckoutFile = join(gitdir, 'info', 'sparse-checkout')
    const fileExists = await fs.exists(sparseCheckoutFile)
    console.log(`[DEBUG Test] sparse-checkout file exists: ${fileExists}, path: ${sparseCheckoutFile}`)
    
    if (!fileExists) {
      throw new Error(`Sparse-checkout file does not exist at ${sparseCheckoutFile}`)
    }
    
    const content = await fs.read(sparseCheckoutFile, 'utf8')
    console.log(`[DEBUG Test] sparse-checkout file content:\n---\n${content}\n---`)
    
    assert.ok(content, 'Sparse-checkout file should exist and have content')
    assert.ok(typeof content === 'string', 'Content should be a string')
    assert.ok(content.includes('src/'), 'Should contain inclusion pattern')
    assert.ok(content.includes('!src/temp/'), 'Should contain exclusion pattern with ! prefix')
    
    // Verify patterns can be listed correctly
    const patterns = await sparseCheckout({ fs, dir, gitdir, list: true })
    assert.ok(patterns.includes('src/'))
    assert.ok(patterns.includes('!src/temp/'))
  })
})

