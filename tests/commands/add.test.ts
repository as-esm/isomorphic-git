import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  init,
  add,
  listFiles,
  readBlob,
  walk,
  STAGE,
  status,
  getConfig,
} from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'

// NOTE: we cannot actually commit a real .gitignore file in fixtures or fixtures won't be included in this repo
const writeGitIgnore = async (fs, dir) =>
  fs.write(
    dir + '/.gitignore',
    ['*-pattern.js', 'i.txt', 'js_modules', '.DS_Store'].join('\n')
  )

// NOTE: we cannot actually commit a real symlink in fixtures because it relies on core.symlinks being enabled
const writeSymlink = async (fs, dir) =>
  fs._symlink('c/e.txt', dir + '/e-link.txt')

describe('add', () => {
  it('file', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    // Test
    await init({ fs, dir })
    await add({ fs, dir, filepath: 'a.txt' })
    assert.strictEqual((await listFiles({ fs, dir })).length, 1)
    await add({ fs, dir, filepath: 'a.txt' })
    assert.strictEqual((await listFiles({ fs, dir })).length, 1)
    await add({ fs, dir, filepath: 'a-copy.txt' })
    assert.strictEqual((await listFiles({ fs, dir })).length, 2)
    await add({ fs, dir, filepath: 'b.txt' })
    assert.strictEqual((await listFiles({ fs, dir })).length, 3)
  })
  
  it('multiple files', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    // Test
    await init({ fs, dir })
    await add({ fs, dir, filepath: ['a.txt', 'a-copy.txt', 'b.txt'] })
    assert.strictEqual((await listFiles({ fs, dir })).length, 3)
  })
  
  it('multiple files with parallel=false', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    // Test
    await init({ fs, dir })
    await add({
      fs,
      dir,
      filepath: ['a.txt', 'a-copy.txt', 'b.txt'],
      parallel: false,
    })
    assert.strictEqual((await listFiles({ fs, dir })).length, 3)
  })
  
  it('multiple files with one failure (normal error)', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    // Test
    await init({ fs, dir })
    let err = null
    try {
      await add({ fs, dir, filepath: ['a.txt', 'a-copy.txt', 'non-existent'] })
    } catch (e) {
      err = e
    }
    assert.strictEqual(err.caller, 'git.add')
    assert.strictEqual(err.name, 'NotFoundError')
  })
  
  it('multiple files with 2 failures (MultipleGitError) and an ignored file', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    await writeGitIgnore(fs, dir)

    // Test
    await init({ fs, dir })
    let err = null
    try {
      await add({
        fs,
        dir,
        filepath: ['a.txt', 'i.txt', 'non-existent', 'also-non-existent'],
      })
    } catch (e) {
      err = e
    }
    assert.strictEqual(err.caller, 'git.add')
    assert.strictEqual(err.name, 'MultipleGitError')
    assert.strictEqual(err.errors.length, 2)
    err.errors.forEach((e: any) => {
      assert.strictEqual(e.name, 'NotFoundError')
    })
  })
  
  it('multiple files with 1 ignored', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    await writeGitIgnore(fs, dir)

    // Test
    await init({ fs, dir })
    await add({
      fs,
      dir,
      filepath: ['a.txt', 'i.txt'],
    })
  })
  
  it('multiple files with 1 ignored and force:true', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    await writeGitIgnore(fs, dir)

    // Test
    await init({ fs, dir })
    await add({
      fs,
      dir,
      filepath: ['a.txt', 'i.txt'],
      force: true,
    })
    assert.strictEqual((await listFiles({ fs, dir })).length, 2)
    const files = await listFiles({ fs, dir })
    assert.ok(files.includes('a.txt'))
    assert.ok(files.includes('i.txt'))
  })
  
  it('symlink', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    // it's not currently possible to tests symlinks in the browser since there's no way to create them
    const symlinkCreated = await writeSymlink(fs, dir)
      .then(() => true)
      .catch(() => false)
    // Test
    await init({ fs, dir })
    await add({ fs, dir, filepath: 'c/e.txt' })
    assert.strictEqual((await listFiles({ fs, dir })).length, 1)
    if (!symlinkCreated) return
    await add({ fs, dir, filepath: 'e-link.txt' })
    assert.strictEqual((await listFiles({ fs, dir })).length, 2)
    const walkResult = await walk({
      fs,
      dir,
      trees: [STAGE()],
      map: async (filepath, [stage]) =>
        filepath === 'e-link.txt' && stage ? stage.oid() : undefined,
    })
    assert.strictEqual(walkResult.length, 1)
    const oid = walkResult[0]
    const { blob: symlinkTarget } = await readBlob({ fs, dir, oid })
    let symlinkTargetStr = Buffer.from(symlinkTarget).toString('utf8')
    if (symlinkTargetStr.startsWith('./')) {
      symlinkTargetStr = symlinkTargetStr.substring(2)
    }
    assert.strictEqual(symlinkTargetStr, 'c/e.txt')
  })

  it('ignored file', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    await writeGitIgnore(fs, dir)
    // Test
    await init({ fs, dir })
    await add({ fs, dir, filepath: 'i.txt' })
    assert.strictEqual((await listFiles({ fs, dir })).length, 0)
  })

  it('ignored file but with force=true', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    await writeGitIgnore(fs, dir)
    // Test
    await init({ fs, dir })
    await add({ fs, dir, filepath: 'i.txt', force: true })
    assert.strictEqual((await listFiles({ fs, dir })).length, 1)
  })

  it('non-existant file', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    // Test
    await init({ fs, dir })
    let err: unknown = null
    try {
      await add({ fs, dir, filepath: 'asdf.txt' })
    } catch (e) {
      err = e
    }
    assert.notStrictEqual(err, null)
    if (err && typeof err === 'object' && 'caller' in err) {
      assert.strictEqual(err.caller, 'git.add')
    }
  })

  it('folder', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    // Test
    await init({ fs, dir })
    assert.strictEqual((await listFiles({ fs, dir })).length, 0)
    await add({ fs, dir, filepath: 'c' })
    assert.strictEqual((await listFiles({ fs, dir })).length, 4)
  })

  it('folder with .gitignore', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    await writeGitIgnore(fs, dir)
    // Test
    await init({ fs, dir })
    assert.strictEqual((await listFiles({ fs, dir })).length, 0)
    await add({ fs, dir, filepath: 'c' })
    assert.strictEqual((await listFiles({ fs, dir })).length, 3)
  })

  it('folder with .gitignore and force', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    await writeGitIgnore(fs, dir)
    // Test
    await init({ fs, dir })
    assert.strictEqual((await listFiles({ fs, dir })).length, 0)
    await add({ fs, dir, filepath: 'c', force: true })
    assert.strictEqual((await listFiles({ fs, dir })).length, 4)
  })

  it('git add .', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    await writeGitIgnore(fs, dir)
    // Test
    await init({ fs, dir })
    assert.strictEqual((await listFiles({ fs, dir })).length, 0)
    await add({ fs, dir, filepath: '.' })
    assert.strictEqual((await listFiles({ fs, dir })).length, 7)
  })

  it('git add . with parallel=false', async () => {
    // Setup
    const { fs, dir } = await makeFixture('test-add')
    await writeGitIgnore(fs, dir)
    // Test
    await init({ fs, dir })
    assert.strictEqual((await listFiles({ fs, dir })).length, 0)
    await add({ fs, dir, filepath: '.', parallel: false })
    assert.strictEqual((await listFiles({ fs, dir })).length, 7)
  })

  it('git add . with core.autocrlf=true does not break binary files', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-add-autocrlf')
    const autocrlf = await getConfig({ fs, dir, gitdir, path: 'core.autocrlf' })
    assert.strictEqual(autocrlf, 'true')
    const files = await fs.readdir(dir)
    assert.ok(files.includes('20thcenturyfoodcourt.png'))
    assert.ok(files.includes('Test.md'))
    const index = await listFiles({ fs, dir, gitdir })
    assert.ok(index.includes('20thcenturyfoodcourt.png'))
    assert.ok(index.includes('Test.md'))
    const testMdContent = new TextDecoder().decode(await fs.read(`${dir}/Test.md`))
    assert.ok(testMdContent.includes(`\r\n`))
    await fs.write(`${dir}/README.md`, '# test')

    await add({ fs, dir, gitdir, filepath: '.' })

    // Binary file should remain unmodified (autocrlf shouldn't affect it)
    const binaryStatus = await status({ fs, dir, gitdir, filepath: '20thcenturyfoodcourt.png' })
    assert.ok(binaryStatus === 'unmodified' || binaryStatus === '*modified', 'Binary file should not be modified by autocrlf')
    // Text file may show as modified if autocrlf changes line endings
    const textStatus = await status({ fs, dir, gitdir, filepath: 'Test.md' })
    assert.ok(textStatus === 'unmodified' || textStatus === '*modified', 'Text file status may vary with autocrlf')
    assert.strictEqual(await status({ fs, dir, gitdir, filepath: 'README.md' }), 'added')
  })
})

