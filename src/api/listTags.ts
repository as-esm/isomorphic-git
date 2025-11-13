import { GitRefManager } from "../managers/GitRefManager.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * List tags
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 *
 * @returns {Promise<Array<string>>} Resolves successfully with an array of tag names
 *
 * @example
 * let tags = await git.listTags({ fs, dir: '/tutorial' })
 * console.log(tags)
 *
 */
export async function listTags({
  fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
}): Promise<string[]> {
  try {
    assertParameter('fs', fs)
    if (!gitdir) {
      throw new Error('gitdir is required')
    }
    assertParameter('gitdir', gitdir)
    return GitRefManager.listTags({ fs: normalizeFs(fs), gitdir })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.listTags'
    throw err
  }
}

