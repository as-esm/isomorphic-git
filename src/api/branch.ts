import { _branch } from '../commands/branch.ts'
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Create a branch
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - What to name the branch
 * @param {string} [args.object = 'HEAD'] - What oid to use as the start point. Accepts a symbolic ref.
 * @param {boolean} [args.checkout = false] - Update `HEAD` to point at the newly created branch
 * @param {boolean} [args.force = false] - Instead of throwing an error if a branched named `ref` already exists, overwrite the existing branch.
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.branch({ fs, dir: '/tutorial', ref: 'develop' })
 * console.log('done')
 *
 */
export async function branch({
  fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  ref,
  object,
  checkout = false,
  force = false,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  ref: string
  object?: string
  checkout?: boolean
  force?: boolean
}): Promise<void> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir!)
    assertParameter('ref', ref)
    return await _branch({
      fs: normalizeFs(fs) as any,
      gitdir: gitdir!,
      ref,
      object,
      checkout,
      force,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.branch'
    throw err
  }
}

