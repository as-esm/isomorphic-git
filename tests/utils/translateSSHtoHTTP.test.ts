import { test } from 'node:test'
import assert from 'node:assert'
import { translateSSHtoHTTP } from '../../src/utils/translateSSHtoHTTP.ts'

test('translateSSHtoHTTP', async (t) => {
  await t.test('translates scp-like syntax', () => {
    const result = translateSSHtoHTTP('git@github.com:user/repo.git')
    assert.strictEqual(result, 'https://github.com/user/repo.git')
  })

  await t.test('translates SSH URL', () => {
    const result = translateSSHtoHTTP('ssh://git@github.com/user/repo.git')
    assert.strictEqual(result, 'https://git@github.com/user/repo.git')
  })

  await t.test('handles scp-like syntax with different host', () => {
    const result = translateSSHtoHTTP('git@gitlab.com:group/project.git')
    assert.strictEqual(result, 'https://gitlab.com/group/project.git')
  })

  await t.test('handles SSH URL without user', () => {
    const result = translateSSHtoHTTP('ssh://github.com/user/repo.git')
    assert.strictEqual(result, 'https://github.com/user/repo.git')
  })

  await t.test('leaves HTTP URLs unchanged', () => {
    const result = translateSSHtoHTTP('https://github.com/user/repo.git')
    assert.strictEqual(result, 'https://github.com/user/repo.git')
  })

  await t.test('leaves HTTPS URLs unchanged', () => {
    const result = translateSSHtoHTTP('https://github.com/user/repo.git')
    assert.strictEqual(result, 'https://github.com/user/repo.git')
  })

  await t.test('handles scp-like syntax with port in host', () => {
    const result = translateSSHtoHTTP('git@github.com:2222:user/repo.git')
    assert.strictEqual(result, 'https://github.com:2222/user/repo.git')
  })

  await t.test('handles complex paths in scp syntax', () => {
    const result = translateSSHtoHTTP('git@example.com:path/to/deep/repo.git')
    assert.strictEqual(result, 'https://example.com/path/to/deep/repo.git')
  })
})

