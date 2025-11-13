import { GitRefManager } from "../managers/GitRefManager.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Expand an abbreviated ref to its full name
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - The ref to expand (like "v1.0.0")
 *
 * @returns {Promise<string>} Resolves successfully with a full ref name ("refs/tags/v1.0.0")
 *
 * @example
 * let fullRef = await git.expandRef({ fs, dir: '/tutorial', ref: 'main'})
 * console.log(fullRef)
 *
 */
export async function expandRef({
  fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  ref,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  ref: string
}): Promise<string> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir!)
    assertParameter('ref', ref)
    return await GitRefManager.expand({
      fs: normalizeFs(fs) as any,
      gitdir: gitdir!,
      ref,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.expandRef'
    throw err
  }
}

