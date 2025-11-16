import { GitAnnotatedTag } from "../models/GitAnnotatedTag.ts"
import { writeObject as writeObjectInternal } from "../git/objects/writeObject.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { TagObject } from "../models/GitAnnotatedTag.ts"

/**
 * Write an annotated tag object directly
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {TagObject} args.tag - The object to write
 *
 * @returns {Promise<string>} Resolves successfully with the SHA-1 object id of the newly written object
 * @see TagObject
 *
 * @example
 * // Manually create an annotated tag.
 * let sha = await git.resolveRef({ fs, dir: '/tutorial', ref: 'HEAD' })
 * console.log('commit', sha)
 *
 * let oid = await git.writeTag({
 *   fs,
 *   dir: '/tutorial',
 *   tag: {
 *     object: sha,
 *     type: 'commit',
 *     tag: 'my-tag',
 *     tagger: {
 *       name: 'your name',
 *       email: 'email@example.com',
 *       timestamp: Math.floor(Date.now()/1000),
 *       timezoneOffset: new Date().getTimezoneOffset()
 *     },
 *     message: 'Optional message'
 *   }
 * })
 *
 * console.log('tag', oid)
 *
 */
export async function writeTag({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  tag,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  tag: TagObject
}): Promise<string> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('tag', tag)

    const fs = normalizeFs(_fs)
    // Convert object to buffer
    const object = GitAnnotatedTag.from(tag).toObject()
    const oid = await writeObjectInternal({
      fs,
      gitdir,
      type: 'tag',
      object,
      format: 'content',
    })
    return oid
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.writeTag'
    throw err
  }
}

