import cleanGitRef from 'clean-git-ref'

import { AlreadyExistsError } from "../errors/AlreadyExistsError.ts"
import { InvalidRefNameError } from "../errors/InvalidRefNameError.ts"
import { NotFoundError } from "../errors/NotFoundError.ts"
import { resolveRef as resolveRefDirect } from "../git/refs/readRef.ts"
import { writeRef as writeRefDirect, writeSymbolicRef as writeSymbolicRefDirect } from "../git/refs/writeRef.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import validRef from "../utils/isValidRef.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Write a ref which refers to the specified SHA-1 object id, or a symbolic ref which refers to the specified ref.
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - The name of the ref to write
 * @param {string} args.value - When `symbolic` is false, a ref or an SHA-1 object id. When true, a ref starting with `refs/`.
 * @param {boolean} [args.force = false] - Instead of throwing an error if a ref named `ref` already exists, overwrite the existing ref.
 * @param {boolean} [args.symbolic = false] - Whether the ref is symbolic or not.
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.writeRef({
 *   fs,
 *   dir: '/tutorial',
 *   ref: 'refs/heads/another-branch',
 *   value: 'HEAD'
 * })
 * await git.writeRef({
 *   fs,
 *   dir: '/tutorial',
 *   ref: 'HEAD',
 *   value: 'refs/heads/another-branch',
 *   force: true,
 *   symbolic: true
 * })
 * console.log('done')
 *
 */
export async function writeRef({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  ref,
  value,
  force = false,
  symbolic = false,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  ref: string
  value: string
  force?: boolean
  symbolic?: boolean
}): Promise<void> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('ref', ref)
    assertParameter('value', value)

    const fs = normalizeFs(_fs)

    if (!validRef(ref, true)) {
      throw new InvalidRefNameError(ref, cleanGitRef.clean(ref))
    }

    if (!force) {
      try {
        await resolveRefDirect({ fs, gitdir, ref })
        throw new AlreadyExistsError('ref', ref)
      } catch (err) {
        if (err instanceof AlreadyExistsError) throw err
        // NotFoundError means ref doesn't exist, which is fine
        if (!(err instanceof NotFoundError)) throw err
      }
    }

    if (symbolic) {
      await writeSymbolicRefDirect({
        fs,
        gitdir,
        ref,
        value,
      })
    } else {
      value = await resolveRefDirect({
        fs,
        gitdir,
        ref: value,
      })
      await writeRefDirect({
        fs,
        gitdir,
        ref,
        value,
      })
    }
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.writeRef'
    throw err
  }
}

