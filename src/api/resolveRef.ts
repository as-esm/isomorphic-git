import { resolveRef as resolveRefDirect } from "../git/refs/readRef.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Get the value of a symbolic ref or resolve a ref to its SHA-1 object id
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - The ref to resolve
 * @param {number} [args.depth = undefined] - How many symbolic references to follow before returning
 *
 * @returns {Promise<string>} Resolves successfully with a SHA-1 object id or the value of a symbolic ref
 *
 * @example
 * let currentCommit = await git.resolveRef({ fs, dir: '/tutorial', ref: 'HEAD' })
 * console.log(currentCommit)
 * let currentBranch = await git.resolveRef({ fs, dir: '/tutorial', ref: 'HEAD', depth: 2 })
 * console.log(currentBranch)
 *
 */
export async function resolveRef({
  fs,
  dir,
  gitdir = join(dir, '.git'),
  ref,
  depth,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  ref: string
  depth?: number
}): Promise<string> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir)
    assertParameter('ref', ref)

    const oid = await resolveRefDirect({
      fs: normalizeFs(fs),
      gitdir,
      ref,
      depth,
    })
    return oid
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.resolveRef'
    throw err
  }
}

