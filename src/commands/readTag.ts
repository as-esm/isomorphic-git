import { ObjectTypeError } from '../errors/ObjectTypeError.js'
import { GitAnnotatedTag } from '../models/GitAnnotatedTag.js'
import { _readObject as readObject } from '../storage/readObject.js'
import type { FsClient } from '../models/FileSystem.js'
import type { ReadTagResult } from '../models/GitAnnotatedTag.js'

/**
 * @param {object} args
 * @param {import('../types.js').FsClient} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string} args.oid
 *
 * @returns {Promise<ReadTagResult>}
 */
export async function _readTag({
  fs,
  cache,
  gitdir,
  oid,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
}): Promise<ReadTagResult> {
  const { type, object } = await readObject({
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
}

