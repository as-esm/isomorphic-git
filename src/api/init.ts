import { _init } from '../commands/init.js'
import { assertParameter } from '../utils/assertParameter.js'
import { join } from '../utils/join.js'
import type { FsClient } from '../models/FileSystem.js'
import type { GitBackend } from '../backends/index.js'

/**
 * Initialize a new repository
 */
export async function init({
  fs,
  bare = false,
  dir,
  gitdir = bare ? dir : (dir ? join(dir, '.git') : undefined),
  defaultBranch = 'master',
  backend,
}: {
  fs: FsClient
  bare?: boolean
  dir?: string
  gitdir?: string
  defaultBranch?: string
  backend?: GitBackend
}): Promise<void> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir!)
    if (!bare) {
      assertParameter('dir', dir)
    }

    return await _init({
      fs,
      bare,
      dir,
      gitdir,
      defaultBranch,
      backend,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.init'
    throw err
  }
}

