import { GitRefManager } from "../managers/GitRefManager.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Delete a local ref
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - The ref to delete
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.deleteRef({ fs, dir: '/tutorial', ref: 'refs/tags/test-tag' })
 * console.log('done')
 *
 */
export async function deleteRef({
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
    await GitRefManager.deleteRef({ fs: normalizeFs(fs) as any, gitdir: gitdir!, ref })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.deleteRef'
    throw err
  }
}

