import { join } from "../utils/join.ts"
import { ConfigAccess } from "../utils/configAccess.ts"
import { RefManager } from "../core-utils/refs/RefManager.ts"
import { FilesystemBackend } from '../backends/index.ts'
import { assertParameter } from "../utils/assertParameter.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { GitBackend } from '../backends/index.ts'

/**
 * Initialize a new repository
 */
export async function init({
  fs: _fs,
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
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir!)
    if (!bare) {
      assertParameter('dir', dir)
    }

    const fs = _fs
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

/**
 * Internal init implementation
 * @internal - Exported for use by other commands (e.g., clone)
 */
export async function _init({
  fs,
  bare = false,
  dir,
  gitdir = bare ? dir : join(dir, '.git'),
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
  // Use backend if provided, otherwise create filesystem backend
  const gitBackend = backend || new FilesystemBackend(fs, gitdir)

  // Check if already initialized
  if (await gitBackend.isInitialized()) {
    return
  }

  // Initialize backend structure
  await gitBackend.initialize()

  // Use ConfigAccess to set initial config values
  const configAccess = new ConfigAccess(fs, gitdir)
  await configAccess.setConfigValue('core.repositoryformatversion', '0', 'local')
  await configAccess.setConfigValue('core.filemode', 'false', 'local')
  await configAccess.setConfigValue('core.bare', bare.toString(), 'local')
  if (!bare) {
    await configAccess.setConfigValue('core.logallrefupdates', 'true', 'local')
  }
  await configAccess.setConfigValue('core.symlinks', 'false', 'local')
  await configAccess.setConfigValue('core.ignorecase', 'true', 'local')

  // Use RefManager to set HEAD (symbolic ref)
  await gitBackend.writeHEAD(`ref: refs/heads/${defaultBranch}`)
}

