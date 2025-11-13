import { _init } from '../commands/init.ts'
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { GitBackend } from '../backends/index.ts'

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

