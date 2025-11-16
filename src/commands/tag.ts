import { AlreadyExistsError } from "../errors/AlreadyExistsError.ts"
import { MissingParameterError } from "../errors/MissingParameterError.ts"
import { RefManager } from "../core-utils/refs/RefManager.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Create a lightweight tag
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - What to name the tag
 * @param {string} [args.object = 'HEAD'] - What oid the tag refers to. (Will resolve to oid if value is a ref.) By default, the commit object which is referred by the current `HEAD` is used.
 * @param {boolean} [args.force = false] - Instead of throwing an error if a tag named `ref` already exists, overwrite the existing tag.
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.tag({ fs, dir: '/tutorial', ref: 'test-tag' })
 * console.log('done')
 *
 */
export async function tag({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  ref,
  object,
  force = false,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  ref: string
  object?: string
  force?: boolean
}): Promise<void> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('ref', ref)

    const fs = normalizeFs(_fs)

    if (ref === undefined) {
      throw new MissingParameterError('ref')
    }

    ref = ref.startsWith('refs/tags/') ? ref : `refs/tags/${ref}`

    // Resolve passed object
    const value = await RefManager.resolve({
      fs,
      gitdir,
      ref: object || 'HEAD',
    })

    if (!force) {
      try {
        await RefManager.resolve({ fs, gitdir, ref })
        // Tag exists
        throw new AlreadyExistsError('tag', ref)
      } catch (e) {
        if (e instanceof AlreadyExistsError) throw e
        // Tag doesn't exist, that's fine
      }
    }

    await RefManager.writeRef({ fs, gitdir, ref, value })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.tag'
    throw err
  }
}

