import { test } from 'node:test'
import assert from 'node:assert'
import * as path from 'path/posix'
import { join } from '../../src/utils/join.ts'

test('join', async (t) => {
  await t.test('when "internal join" generates paths the same as "path.join"', async (t) => {
    // Tests adapted from path-browserify
    const fixtures = [
      ['/foo/bar', 'baz'],
      ['foo/bar', 'baz'],
      ['foo', 'bar', 'baz'],
      ['/', 'foo', 'bar', 'baz'],
      ['.', 'foo'],
      ['foo', '.'],
      ['.', '.'],
      ['.', 'foo', '.'],
      ['.', '.', '.'],
      ['/', '.'],
      ['/', '.git'],
      ['.', '.git'],
      [],
      ['foo/x', './bar'],
      ['foo/x/', './bar'],
      ['foo/x/', '.', 'bar'],
      ['.', '.', '.'],
      ['.', './', '.'],
      ['.', '/./', '.'],
      ['.', '/////./', '.'],
      ['.'],
      ['', '.'],
      ['foo', '/bar'],
      ['foo', ''],
      ['foo', '', '/bar'],
      ['/'],
      ['/', '.'],
      [''],
      ['', ''],
      ['', 'foo'],
      ['', '', 'foo'],
      [' /foo'],
      [' ', 'foo'],
      [' ', '.'],
      [' ', ''],
      ['/', '/foo'],
      ['/', '//foo'],
      ['/', '', '/foo'],
    ]
    for (const fixture of fixtures) {
      await t.test(`"${JSON.stringify(fixture)}" should join to "${path.join(...fixture)}"`, () => {
        assert.strictEqual(join(...fixture), path.join(...fixture))
      })
    }
  })
})

