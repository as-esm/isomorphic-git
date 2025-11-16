import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  Errors,
  merge,
  readBlob,
  resolveRef,
  abortMerge,
  add,
  STAGE,
  TREE,
  WORKDIR,
  walk,
} from 'isomorphic-git'
import { Repository } from '../../src/core-utils/Repository.ts'
import { modified } from '../../src/utils/modified.ts'
import { makeFixture } from '../helpers/fixture.ts'

describe('abortMerge', () => {
  it('write conflicted files to index at different stages', async () => {
    // Setup
    const { gitdir, dir, fs } = await makeFixture('test-abortMerge')

    const branchA = await resolveRef({ fs, gitdir, ref: 'a' })
    const branchB = await resolveRef({ fs, gitdir, ref: 'b' })
    const ancestor = '2d7b1a9b82e52bd8648cf156aa559eff3a27a678' // common ancestor, hard coded, not ideal

    const fileAVersions = [
      await readBlob({ fs, gitdir, oid: ancestor, filepath: 'a' }),
      await readBlob({ fs, gitdir, oid: branchA, filepath: 'a' }),
      await readBlob({ fs, gitdir, oid: branchB, filepath: 'a' }),
    ]

    const fileBVersions = [
      await readBlob({ fs, gitdir, oid: ancestor, filepath: 'b' }),
      await readBlob({ fs, gitdir, oid: branchA, filepath: 'b' }),
      await readBlob({ fs, gitdir, oid: branchB, filepath: 'b' }),
    ]

    // Test
    let error: unknown = null
    try {
      await merge({
        fs,
        dir,
        gitdir,
        ours: 'a',
        theirs: 'b',
        abortOnConflict: false,
        author: {
          name: 'Mr. Test',
          email: 'mrtest@example.com',
          timestamp: 1262356920,
          timezoneOffset: -0,
        },
      })
    } catch (e) {
      error = e
    }
    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.MergeConflictError || (error as any).code === Errors.MergeConflictError.code)

    const repo = await Repository.open({ fs, dir, gitdir, cache: {}, autoDetectConfig: true })
    const index = await repo.readIndexDirect()
    assert.strictEqual(index.unmergedPaths.length, 2)
    assert.strictEqual(index.entriesFlat.length, 7)
    assert.ok(index.unmergedPaths.includes('a'))
    assert.ok(index.unmergedPaths.includes('b'))
    assert.strictEqual(index.entriesMap.get('a').stages.length, 4)
    assert.strictEqual(index.entriesMap.get('b').stages.length, 4)
    assert.strictEqual(index.entriesMap.get('c').stages.length, 1)
    const fileAStages = [
      await readBlob({
        fs,
        gitdir,
        oid: index.entriesMap.get('a').stages[1].oid,
      }),
      await readBlob({
        fs,
        gitdir,
        oid: index.entriesMap.get('a').stages[2].oid,
      }),
      await readBlob({
        fs,
        gitdir,
        oid: index.entriesMap.get('a').stages[3].oid,
      }),
    ]
    const fileBStages = [
      await readBlob({
        fs,
        gitdir,
        oid: index.entriesMap.get('b').stages[1].oid,
      }),
      await readBlob({
        fs,
        gitdir,
        oid: index.entriesMap.get('b').stages[2].oid,
      }),
      await readBlob({
        fs,
        gitdir,
        oid: index.entriesMap.get('b').stages[3].oid,
      }),
    ]
    assert.deepStrictEqual(fileAVersions, fileAStages)
    assert.deepStrictEqual(fileBVersions, fileBStages)
  })

  it('abort merge without touching anything', async () => {
    // Setup
    const { fs, gitdir, dir } = await makeFixture('test-abortMerge')

    // Test
    let error: unknown = null
    try {
      await merge({
        fs,
        dir,
        gitdir,
        ours: 'a',
        theirs: 'b',
        abortOnConflict: false,
        author: {
          name: 'Mr. Test',
          email: 'mrtest@example.com',
          timestamp: 1262356920,
          timezoneOffset: -0,
        },
      })
    } catch (e) {
      error = e
    }

    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.MergeConflictError || (error as any).code === Errors.MergeConflictError.code)

    await abortMerge({ fs, dir, gitdir })

    const trees = [TREE({ ref: 'HEAD' }), WORKDIR(), STAGE()]
    await walk({
      fs,
      dir,
      gitdir,
      trees,
      map: async function (path, [head, workdir, index]) {
        if (path === '.') return

        if (head && index) {
          assert.deepStrictEqual([path, await head.mode()], [path, await index.mode()])
          assert.deepStrictEqual([path, await head.oid()], [path, await index.oid()])
        }

        assert.strictEqual(await modified(index, head), false)

        // only since we didn't touch anything
        assert.strictEqual(await modified(workdir, head), false)

        assert.strictEqual(await modified(index, workdir), false)
      },
    })
  })

  it('abort merge after modifying files', async () => {
    // Setup
    const { fs, gitdir, dir } = await makeFixture('test-abortMerge')

    // Test
    let error: unknown = null
    try {
      await merge({
        fs,
        dir,
        gitdir,
        ours: 'a',
        theirs: 'b',
        abortOnConflict: false,
        author: {
          name: 'Mr. Test',
          email: 'mrtest@example.com',
          timestamp: 1262356920,
          timezoneOffset: -0,
        },
      })
    } catch (e) {
      error = e
    }

    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.MergeConflictError || (error as any).code === Errors.MergeConflictError.code)

    await fs.rm(`${dir}/a`)
    await fs.write(`${dir}/b`, 'new text for file b')
    await fs.write(`${dir}/c`, 'new text for file c')

    await abortMerge({ fs, dir, gitdir })

    const trees = [TREE({ ref: 'HEAD' }), WORKDIR(), STAGE()]
    await walk({
      fs,
      dir,
      gitdir,
      trees,
      map: async function (path, [head, workdir, index]) {
        if (path === '.') return

        if (path === 'b') {
          assert.strictEqual(await modified(workdir, head), false)
          assert.strictEqual(await modified(workdir, index), false)
        }

        if (head && index) {
          assert.deepStrictEqual([path, await head.mode()], [path, await index.mode()])
          assert.deepStrictEqual([path, await head.oid()], [path, await index.oid()])
        }

        assert.strictEqual(await modified(index, head), false)
      },
    })
    const fileCContent = new TextDecoder().decode(await fs.read(`${dir}/c`))
    const fileBContent = new TextDecoder().decode(await fs.read(`${dir}/b`))
    assert.strictEqual(fileCContent, 'new text for file c')
    assert.notStrictEqual(fileBContent, 'new text for file b')
  })

  it('workdir != index && index === head (keep our changes)', async () => {
    // Setup
    const { fs, gitdir, dir } = await makeFixture('test-abortMerge')

    const head = await resolveRef({ fs, gitdir, ref: 'HEAD' })

    const fileAHeadVersion = await readBlob({
      fs,
      gitdir,
      oid: head,
      filepath: 'a',
    }).then(result => {
      return new TextDecoder().decode(result.blob)
    })
    const fileBHeadVersion = await readBlob({
      fs,
      gitdir,
      oid: head,
      filepath: 'b',
    }).then(result => {
      return new TextDecoder().decode(result.blob)
    })

    // Test
    let error: unknown = null
    try {
      await merge({
        fs,
        dir,
        gitdir,
        ours: 'a',
        theirs: 'b',
        abortOnConflict: false,
        author: {
          name: 'Mr. Test',
          email: 'mrtest@example.com',
          timestamp: 1262356920,
          timezoneOffset: -0,
        },
      })
    } catch (e) {
      error = e
    }

    assert.notStrictEqual(error, null)
    assert.ok(error instanceof Errors.MergeConflictError || (error as any).code === Errors.MergeConflictError.code)

    await fs.write(`${dir}/c`, 'new text for file c')
    await abortMerge({ fs, dir, gitdir })

    const fileAContent = await fs.read(`${dir}/a`).then(buffer => {
      return buffer.toString()
    })
    const fileBContent = await fs.read(`${dir}/b`).then(buffer => {
      return buffer.toString()
    })
    const fileCContent = await fs.read(`${dir}/c`).then(buffer => {
      return buffer.toString()
    })

    const dirContents = await fs.readdir(dir)

    assert.strictEqual(dirContents.length, 3)
    assert.strictEqual(fileAContent, fileAHeadVersion)
    assert.strictEqual(fileBContent, fileBHeadVersion)
    assert.strictEqual(fileCContent, 'new text for file c')
  })
})

