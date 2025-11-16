import { test } from 'node:test'
import assert from 'node:assert'
import { parse, loadAttributes, getAttributes, hasAttribute } from '../../../src/core-utils/filesystem/GitAttributesParser.ts'
import { makeFixture } from '../../helpers/fixture.ts'

test('GitAttributesParser', async (t) => {
  await t.test('parse - empty content returns empty array', () => {
    const result = parse('')
    assert.deepStrictEqual(result, [])
  })

  await t.test('parse - parses simple attribute rule', () => {
    const content = '*.txt text'
    const result = parse(content)
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].pattern, '*.txt')
    assert.strictEqual(result[0].attributes.text, true)
  })

  await t.test('parse - parses attribute with value', () => {
    const content = '*.txt eol=lf'
    const result = parse(content)
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].pattern, '*.txt')
    assert.strictEqual(result[0].attributes.eol, 'lf')
  })

  await t.test('parse - parses multiple attributes', () => {
    const content = '*.txt text eol=lf diff'
    const result = parse(content)
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].pattern, '*.txt')
    assert.strictEqual(result[0].attributes.text, true)
    assert.strictEqual(result[0].attributes.eol, 'lf')
    assert.strictEqual(result[0].attributes.diff, true)
  })

  await t.test('parse - skips empty lines', () => {
    const content = '*.txt text\n\n*.js binary'
    const result = parse(content)
    assert.strictEqual(result.length, 2)
    assert.strictEqual(result[0].pattern, '*.txt')
    assert.strictEqual(result[1].pattern, '*.js')
  })

  await t.test('parse - skips comment lines', () => {
    const content = '# This is a comment\n*.txt text\n# Another comment\n*.js binary'
    const result = parse(content)
    assert.strictEqual(result.length, 2)
    assert.strictEqual(result[0].pattern, '*.txt')
    assert.strictEqual(result[1].pattern, '*.js')
  })

  await t.test('parse - skips lines with only pattern', () => {
    const content = '*.txt text\n*.js\n*.py binary'
    const result = parse(content)
    assert.strictEqual(result.length, 2)
    assert.strictEqual(result[0].pattern, '*.txt')
    assert.strictEqual(result[1].pattern, '*.py')
  })

  await t.test('parse - handles multiple rules', () => {
    const content = '*.txt text\n*.js binary\n*.py eol=lf'
    const result = parse(content)
    assert.strictEqual(result.length, 3)
    assert.strictEqual(result[0].pattern, '*.txt')
    assert.strictEqual(result[1].pattern, '*.js')
    assert.strictEqual(result[2].pattern, '*.py')
  })

  await t.test('parse - handles attributes with equals in value (split limit)', () => {
    const content = '*.txt filter=myfilter=value'
    const result = parse(content)
    assert.strictEqual(result.length, 1)
    // split('=', 2) limits splits, so 'filter=myfilter=value' becomes ['filter', 'myfilter', 'value']
    // but destructuring [key, value] only takes first two, so value is 'myfilter'
    assert.strictEqual(result[0].attributes.filter, 'myfilter')
  })

  await t.test('parse - handles whitespace in pattern', () => {
    const content = '  *.txt   text   eol=lf  '
    const result = parse(content)
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].pattern, '*.txt')
    assert.strictEqual(result[0].attributes.text, true)
    assert.strictEqual(result[0].attributes.eol, 'lf')
  })

  await t.test('loadAttributes - loads from root .gitattributes', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await fs.write(join(dir, '.gitattributes'), '*.txt text eol=lf\n*.js binary')
    
    const result = await loadAttributes({ fs, dir, filepath: 'test.txt' })
    assert.strictEqual(result.text, true)
    assert.strictEqual(result.eol, 'lf')
  })

  await t.test('loadAttributes - loads from nested .gitattributes', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await fs.mkdir(join(dir, 'subdir'))
    await fs.write(join(dir, '.gitattributes'), '*.txt text')
    await fs.write(join(dir, 'subdir', '.gitattributes'), '*.txt eol=crlf')
    
    const result = await loadAttributes({ fs, dir, filepath: 'subdir/test.txt' })
    assert.strictEqual(result.text, true)
    assert.strictEqual(result.eol, 'crlf') // Nested overrides
  })

  await t.test('loadAttributes - handles deeply nested paths', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    // Create nested directories one at a time
    await fs.mkdir(join(dir, 'level1'))
    await fs.mkdir(join(dir, 'level1', 'level2'))
    await fs.mkdir(join(dir, 'level1', 'level2', 'level3'))
    await fs.write(join(dir, '.gitattributes'), '*.txt text')
    await fs.write(join(dir, 'level1', '.gitattributes'), '*.txt eol=lf')
    await fs.write(join(dir, 'level1', 'level2', '.gitattributes'), '*.txt diff')
    
    const result = await loadAttributes({ fs, dir, filepath: 'level1/level2/level3/test.txt' })
    assert.strictEqual(result.text, true)
    assert.strictEqual(result.eol, 'lf')
    assert.strictEqual(result.diff, true)
  })

  await t.test('loadAttributes - handles missing .gitattributes files', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    
    const result = await loadAttributes({ fs, dir, filepath: 'test.txt' })
    assert.deepStrictEqual(result, {})
  })

  await t.test('loadAttributes - merges attributes from multiple files', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await fs.mkdir(join(dir, 'subdir'))
    await fs.write(join(dir, '.gitattributes'), '*.txt text')
    await fs.write(join(dir, 'subdir', '.gitattributes'), '*.txt eol=lf diff')
    
    const result = await loadAttributes({ fs, dir, filepath: 'subdir/test.txt' })
    assert.strictEqual(result.text, true)
    assert.strictEqual(result.eol, 'lf')
    assert.strictEqual(result.diff, true)
  })

  await t.test('getAttributes - returns attributes for filepath', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await fs.write(join(dir, '.gitattributes'), '*.txt text eol=lf')
    
    const result = await getAttributes({ fs, dir, filepath: 'test.txt' })
    assert.strictEqual(result.text, true)
    assert.strictEqual(result.eol, 'lf')
  })

  await t.test('hasAttribute - returns attribute value if present', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await fs.write(join(dir, '.gitattributes'), '*.txt text eol=lf')
    
    const result1 = await hasAttribute({ fs, dir, filepath: 'test.txt', attribute: 'text' })
    assert.strictEqual(result1, true)
    
    const result2 = await hasAttribute({ fs, dir, filepath: 'test.txt', attribute: 'eol' })
    assert.strictEqual(result2, 'lf')
  })

  await t.test('hasAttribute - returns false if attribute not present', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    await fs.write(join(dir, '.gitattributes'), '*.txt text')
    
    const result = await hasAttribute({ fs, dir, filepath: 'test.txt', attribute: 'binary' })
    assert.strictEqual(result, false)
  })

  await t.test('hasAttribute - returns false for file with no attributes', async () => {
    const { fs, dir } = await makeFixture('test-empty')
    
    const result = await hasAttribute({ fs, dir, filepath: 'test.txt', attribute: 'text' })
    assert.strictEqual(result, false)
  })

  await t.test('parse - handles pattern with negation', () => {
    const content = '!*.txt text'
    const result = parse(content)
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].pattern, '!*.txt')
  })
})

// Helper function for join
function join(...paths: string[]): string {
  return paths.filter(Boolean).join('/').replace(/\/+/g, '/')
}

