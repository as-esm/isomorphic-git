import { _currentBranch } from "../commands/currentBranch.ts"
import { NotFoundError } from '../errors/NotFoundError.ts'
import { RefManager } from "../core-utils/refs/RefManager.ts"
import { parse as parseConfig, serialize as serializeConfig } from "../core-utils/ConfigParser.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { abbreviateRef } from "../utils/abbreviateRef.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Delete a local branch
 *
 * > Note: This only deletes loose branches - it should be fixed in the future to delete packed branches as well.
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - The branch to delete
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.deleteBranch({ fs, dir: '/tutorial', ref: 'local-branch' })
 * console.log('done')
 *
 */
export async function deleteBranch({
  fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  ref,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  ref: string
}): Promise<void> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir!)
    assertParameter('ref', ref)
    return await _deleteBranch({
      fs: normalizeFs(fs) as any,
      gitdir: gitdir!,
      ref,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.deleteBranch'
    throw err
  }
}

/**
 * @param {Object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {string} args.ref
 *
 * @returns {Promise<void>}
 */
export async function _deleteBranch({ fs, gitdir, ref }: { fs: FsClient; gitdir: string; ref: string }): Promise<void> {
  ref = ref.startsWith('refs/heads/') ? ref : `refs/heads/${ref}`
  try {
    await RefManager.resolve({ fs, gitdir, ref })
  } catch (e) {
    throw new NotFoundError(ref)
  }

  const currentRef = await _currentBranch({ fs, gitdir, fullname: true })
  if (ref === currentRef) {
    // detach HEAD
    const value = await RefManager.resolve({ fs, gitdir, ref })
    await RefManager.writeRef({ fs, gitdir, ref: 'HEAD', value })
  }

  // Delete a specified branch
  await RefManager.deleteRef({ fs, gitdir, ref })

  // Delete branch config entries
  const abbrevRef = abbreviateRef(ref)
  let configBuffer = Buffer.alloc(0)
  try {
    configBuffer = await fs.read(join(gitdir, 'config'))
  } catch (err) {
    // Config doesn't exist
    return
  }
  const config = parseConfig(configBuffer)
  config.deleteSection('branch', abbrevRef)
  const updatedConfig = serializeConfig(config)
  await fs.write(join(gitdir, 'config'), updatedConfig)
}

