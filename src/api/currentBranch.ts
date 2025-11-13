import { _currentBranch } from "../commands/currentBranch.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Get the name of the branch currently pointed to by .git/HEAD
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {boolean} [args.fullname = false] - Return the full path (e.g. "refs/heads/main") instead of the abbreviated form.
 * @param {boolean} [args.test = false] - If the current branch doesn't actually exist (such as right after git init) then return `undefined`.
 *
 * @returns {Promise<string|void>} The name of the current branch or undefined if the HEAD is detached.
 *
 * @example
 * // Get the current branch name
 * let branch = await git.currentBranch({
 *   fs,
 *   dir: '/tutorial',
 *   fullname: false
 * })
 * console.log(branch)
 *
 */
export async function currentBranch({
  fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  fullname = false,
  test = false,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  fullname?: boolean
  test?: boolean
}): Promise<string | undefined> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir!)
    const result = await _currentBranch({
      fs: normalizeFs(fs) as any,
      gitdir: gitdir!,
      fullname,
      test,
    })
    return result === undefined ? undefined : result
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.currentBranch'
    throw err
  }
}

