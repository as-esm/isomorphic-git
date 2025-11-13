// @ts-check
import '../typedefs.js'

import { join } from "../utils/join.ts"
import { ConfigAccess } from "../utils/configAccess.ts"
import { RefManager } from "../core-utils/refs/RefManager.ts"
import { FilesystemBackend } from '../backends/index.js'

/**
 * Initialize a new repository
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {boolean} [args.bare = false] - Initialize a bare repository
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir] - The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.defaultBranch = 'master'] - The default branch name
 * @param {GitBackend} [args.backend] - The git backend to use
 *
 * @returns {Promise<void>}
 */
export async function _init({
  fs,
  bare = false,
  dir,
  gitdir = bare ? dir : join(dir, '.git'),
  defaultBranch = 'master',
  backend,
}) {
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
