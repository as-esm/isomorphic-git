import { GitRefManager } from "../managers/GitRefManager.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * List refs
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.filepath] - [required] The refs path to list
 *
 * @returns {Promise<Array<string>>} Resolves successfully with an array of ref names below the supplied `filepath`
 *
 * @example
 * let refs = await git.listRefs({ fs, dir: '/tutorial', filepath: 'refs/heads' })
 * console.log(refs)
 *
 */
export async function listRefs({
  fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  filepath,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  filepath: string
}): Promise<string[]> {
  try {
    assertParameter('fs', fs)
    if (!gitdir) {
      throw new Error('gitdir is required')
    }
    assertParameter('gitdir', gitdir)
    return GitRefManager.listRefs({ fs: normalizeFs(fs) as any, gitdir, filepath })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.listRefs'
    throw err
  }
}

