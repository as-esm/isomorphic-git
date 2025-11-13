import { _renameBranch } from "../commands/renameBranch.js"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Rename a branch
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - What to name the branch
 * @param {string} args.oldref - What the name of the branch was
 * @param {boolean} [args.checkout = false] - Update `HEAD` to point at the newly created branch
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.renameBranch({ fs, dir: '/tutorial', ref: 'main', oldref: 'master' })
 * console.log('done')
 *
 */
export async function renameBranch({
  fs,
  dir,
  gitdir = join(dir, '.git'),
  ref,
  oldref,
  checkout = false,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  ref: string
  oldref: string
  checkout?: boolean
}): Promise<void> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir)
    assertParameter('ref', ref)
    assertParameter('oldref', oldref)
    return await _renameBranch({
      fs: normalizeFs(fs),
      gitdir,
      ref,
      oldref,
      checkout,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.renameBranch'
    throw err
  }
}

