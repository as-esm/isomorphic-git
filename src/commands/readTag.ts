import { ObjectTypeError } from "../errors/ObjectTypeError.ts"
import { GitAnnotatedTag } from "../models/GitAnnotatedTag.ts"
import { readObject as readObjectInternal } from "../git/objects/readObject.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { ReadTagResult } from "../models/GitAnnotatedTag.ts"

/**
 * Read an annotated tag object directly
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.oid - The SHA-1 object id to get
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<ReadTagResult>} Resolves successfully with a git object description
 * @see ReadTagResult
 * @see TagObject
 *
 */
export async function readTag({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  oid,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  oid: string
  cache?: Record<string, unknown>
}): Promise<ReadTagResult> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('oid', oid)

    const fs = normalizeFs(_fs)
    const { type, object } = await readObjectInternal({
      fs,
      cache,
      gitdir,
      oid,
      format: 'content',
    })
    if (type !== 'tag') {
      throw new ObjectTypeError(oid, type, 'tag')
    }
    const tag = GitAnnotatedTag.from(object)
    const result: ReadTagResult = {
      oid,
      tag: tag.parse(),
      payload: tag.payload(),
    }
    return result
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.readTag'
    throw err
  }
}

