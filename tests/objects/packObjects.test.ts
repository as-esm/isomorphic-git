import { test } from 'node:test'
import assert from 'node:assert'
import { packObjects, indexPack, readObject } from 'isomorphic-git'
import { makeFixture } from '../helpers/fixture.ts'
import { join } from '../../src/utils/join.ts'
import { read } from '../../src/git/objects/pack.ts'

test('packObjects', async (t) => {
  await t.test('makes a packfile', async () => {
    const { fs, gitdir } = await makeFixture('test-packObjects')
    const { filename, packfile } = await packObjects({
      fs,
      gitdir,
      oids: [
        '5a9da3272badb2d3c8dbab463aed5741acb15a33',
        '0bfe8fa3764089465235461624f2ede1533e74ec',
        '414a0afa7e20452d90ab52de1c024182531c5c52',
        '97b32c43e96acc7873a1990e409194cb92421522',
        '328e74b65839f7e5a8ae3b54e0b49180a5b7b82b',
        'fdba2ad440c231d15a2179f729b4b50ab5860df2',
        '5171f8a8291d7edc31a6670800d5967cfd6be830',
        '7983b4770a894a068152dfe6f347ea9b5ae561c5',
        'f03ae7b490022507f83729b9227e723ab1587a38',
        'a59efbcd7640e659ec81887a2599711f8d9ef801',
        'e5abf40a5b37382c700f51ac5c2aeefdadb8e184',
        '5477471ab5a6a8f2c217023532475044117a8f2c',
      ],
    })
    
    assert.ok(packfile, 'packfile should be present when write is false')
    assert.ok(filename, 'filename should be present')
    assert.ok(filename.startsWith('pack-'), 'filename should start with pack-')
    assert.ok(filename.endsWith('.pack'), 'filename should end with .pack')
    
    // When write is false, packfile should not be written to disk
    const packfilePath = join(gitdir, `objects/pack/${filename}`)
    const exists = await fs.exists(packfilePath)
    assert.strictEqual(exists, false, 'packfile should not exist on disk when write is false')
  })

  await t.test('save packfile', async () => {
    const { fs, dir, gitdir } = await makeFixture('test-packObjects')
    const oids = [
      '5a9da3272badb2d3c8dbab463aed5741acb15a33',
      '0bfe8fa3764089465235461624f2ede1533e74ec',
      '414a0afa7e20452d90ab52de1c024182531c5c52',
      '97b32c43e96acc7873a1990e409194cb92421522',
      '328e74b65839f7e5a8ae3b54e0b49180a5b7b82b',
      'fdba2ad440c231d15a2179f729b4b50ab5860df2',
      '5171f8a8291d7edc31a6670800d5967cfd6be830',
      '7983b4770a894a068152dfe6f347ea9b5ae561c5',
      'f03ae7b490022507f83729b9227e723ab1587a38',
      'a59efbcd7640e659ec81887a2599711f8d9ef801',
      'e5abf40a5b37382c700f51ac5c2aeefdadb8e184',
      '5477471ab5a6a8f2c217023532475044117a8f2c',
    ]
    
    const { filename } = await packObjects({
      fs,
      gitdir,
      oids,
      write: true,
    })
    
    const filepath = `objects/pack/${filename}`
    const cache = {}
    const fixcache = {}
    const fixdir = join(dir, 'git')
    const fullpath = join(gitdir, filepath)
    
    assert.ok(await fs.exists(fullpath), 'packfile should exist on disk when write is true')
    
    // Create index from packfile
    const getExternalRefDelta = async (oid: string) => {
      const result = await readObject({ fs, cache, gitdir, oid })
      return { type: result.type || '', object: result.object }
    }
    
    await indexPack({ fs, dir: gitdir, filepath, gitdir, cache })
    
    // Verify all objects can be read from the packfile
    await Promise.all(
      oids.map(async (oid) => {
        // Read from the packfile we just created
        const object = await read({
          fs,
          gitdir,
          oid,
          cache,
          getExternalRefDelta,
        })
        
        // Read from the fixture packfile for comparison
        const fixture = await read({
          fs,
          gitdir: fixdir,
          oid,
          getExternalRefDelta,
          cache: fixcache,
        })
        
        assert.ok(object, `Object ${oid} should be readable from packfile`)
        assert.ok(fixture, `Object ${oid} should be readable from fixture`)
        
        // Compare object types and content (excluding source which may differ)
        assert.strictEqual(object.type, fixture.type, `Object ${oid} should have same type`)
        assert.deepStrictEqual(
          Buffer.from(object.object),
          Buffer.from(fixture.object),
          `Object ${oid} should have same content`
        )
      })
    )
  })
})

