import { ObjectTypeError } from "../errors/ObjectTypeError.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { GitAnnotatedTag } from "../models/GitAnnotatedTag.ts"
import { GitCommit } from "../models/GitCommit.ts"
import { GitTree } from "../models/GitTree.ts"
import { readObject as readObjectInternal } from "../git/objects/readObject.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { resolveFilepath } from "../utils/resolveFilepath.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { CommitObject } from "../models/GitCommit.ts"
import type { TreeObject } from "../models/GitTree.ts"
import type { TagObject } from "../models/GitAnnotatedTag.ts"

/**
 * Deflated object result
 */
export type DeflatedObject = {
  oid: string
  type: 'deflated'
  format: 'deflated'
  object: Uint8Array
  source?: string
}

/**
 * Wrapped object result
 */
export type WrappedObject = {
  oid: string
  type: 'wrapped'
  format: 'wrapped'
  object: Uint8Array
  source?: string
}

/**
 * Raw object result
 */
export type RawObject = {
  oid: string
  type: 'blob' | 'commit' | 'tree' | 'tag'
  format: 'content'
  object: Uint8Array
  source?: string
}

/**
 * Parsed blob object result
 */
export type ParsedBlobObject = {
  oid: string
  type: 'blob'
  format: 'parsed'
  object: string
  source?: string
}

/**
 * Parsed commit object result
 */
export type ParsedCommitObject = {
  oid: string
  type: 'commit'
  format: 'parsed'
  object: CommitObject
  source?: string
}

/**
 * Parsed tree object result
 */
export type ParsedTreeObject = {
  oid: string
  type: 'tree'
  format: 'parsed'
  object: TreeObject
  source?: string
}

/**
 * Parsed tag object result
 */
export type ParsedTagObject = {
  oid: string
  type: 'tag'
  format: 'parsed'
  object: TagObject
  source?: string
}

/**
 * Parsed object result (union type)
 */
export type ParsedObject = ParsedBlobObject | ParsedCommitObject | ParsedTreeObject | ParsedTagObject

/**
 * Read object result (union type)
 */
export type ReadObjectResult = DeflatedObject | WrappedObject | RawObject | ParsedObject

/**
 * Read a git object directly by its SHA-1 object id
 *
 * Regarding `ReadObjectResult`:
 *
 * - `oid` will be the same as the `oid` argument unless the `filepath` argument is provided, in which case it will be the oid of the tree or blob being returned.
 * - `type` of deflated objects is `'deflated'`, and `type` of wrapped objects is `'wrapped'`
 * - `format` is usually, but not always, the format you requested. Packfiles do not store each object individually compressed so if you end up reading the object from a packfile it will be returned in format 'content' even if you requested 'deflated' or 'wrapped'.
 * - `object` will be an actual Object if format is 'parsed' and the object is a commit, tree, or annotated tag. Blobs are still formatted as Buffers unless an encoding is provided in which case they'll be strings. If format is anything other than 'parsed', object will be a Buffer.
 * - `source` is the name of the packfile or loose object file where the object was found.
 *
 * The `format` parameter can have the following values:
 *
 * | param      | description                                                                                                                                                                                               |
 * | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
 * | 'deflated' | Return the raw deflate-compressed buffer for an object if possible. Useful for efficiently shuffling around loose objects when you don't care about the contents and can save time by not inflating them. |
 * | 'wrapped'  | Return the inflated object buffer wrapped in the git object header if possible. This is the raw data used when calculating the SHA-1 object id of a git object.                                           |
 * | 'content'  | Return the object buffer without the git header.                                                                                                                                                          |
 * | 'parsed'   | Returns a parsed representation of the object.                                                                                                                                                            |
 *
 * The result will be in one of the following schemas:
 *
 * ## `'deflated'` format
 *
 * {@link DeflatedObject typedef}
 *
 * ## `'wrapped'` format
 *
 * {@link WrappedObject typedef}
 *
 * ## `'content'` format
 *
 * {@link RawObject typedef}
 *
 * ## `'parsed'` format
 *
 * ### parsed `'blob'` type
 *
 * {@link ParsedBlobObject typedef}
 *
 * ### parsed `'commit'` type
 *
 * {@link ParsedCommitObject typedef}
 * {@link CommitObject typedef}
 *
 * ### parsed `'tree'` type
 *
 * {@link ParsedTreeObject typedef}
 * {@link TreeObject typedef}
 * {@link TreeEntry typedef}
 *
 * ### parsed `'tag'` type
 *
 * {@link ParsedTagObject typedef}
 * {@link TagObject typedef}
 *
 * @deprecated
 * > This command is overly complicated.
 * >
 * > If you know the type of object you are reading, use [`readBlob`](./readBlob.md), [`readCommit`](./readCommit.md), [`readTag`](./readTag.md), or [`readTree`](./readTree.md).
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.oid - The SHA-1 object id to get
 * @param {'deflated' | 'wrapped' | 'content' | 'parsed'} [args.format = 'parsed'] - What format to return the object in. The choices are described in more detail below.
 * @param {string} [args.filepath] - Don't return the object with `oid` itself, but resolve `oid` to a tree and then return the object at that filepath. To return the root directory of a tree set filepath to `''`
 * @param {string} [args.encoding] - A convenience argument that only affects blobs. Instead of returning `object` as a buffer, it returns a string parsed using the given encoding.
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<ReadObjectResult>} Resolves successfully with a git object description
 * @see ReadObjectResult
 *
 * @example
 * // Given a ransom SHA-1 object id, figure out what it is
 * let { type, object } = await git.readObject({
 *   fs,
 *   dir: '/tutorial',
 *   oid: '0698a781a02264a6f37ba3ff41d78067eaf0f075'
 * })
 * switch (type) {
 *   case 'commit': {
 *     console.log(object)
 *     break
 *   }
 *   case 'tree': {
 *     console.log(object)
 *     break
 *   }
 *   case 'blob': {
 *     console.log(object)
 *     break
 *   }
 *   case 'tag': {
 *     console.log(object)
 *     break
 *   }
 * }
 *
 */
export async function readObject({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  oid,
  format = 'parsed',
  filepath = undefined,
  encoding = undefined,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  oid: string
  format?: 'deflated' | 'wrapped' | 'content' | 'parsed'
  filepath?: string
  encoding?: string
  cache?: Record<string, unknown>
}): Promise<ReadObjectResult> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('oid', oid)

    const fs = normalizeFs(_fs)
    let resolvedOid = oid
    if (filepath !== undefined) {
      resolvedOid = await resolveFilepath({
        fs,
        cache,
        gitdir,
        oid,
        filepath,
      })
    }
    // GitObjectManager does not know how to parse content, so we tweak that parameter before passing it.
    const _format = format === 'parsed' ? 'content' : format
    const result = await readObjectInternal({
      fs,
      cache,
      gitdir,
      oid: resolvedOid,
      format: _format,
    })
    result.oid = resolvedOid
    if (format === 'parsed') {
      result.format = 'parsed'
      switch (result.type) {
        case 'commit':
          result.object = GitCommit.from(result.object as Uint8Array).parse()
          break
        case 'tree':
          result.object = GitTree.from(result.object as Uint8Array).entries()
          break
        case 'blob':
          // Here we consider returning a raw Buffer as the 'content' format
          // and returning a string as the 'parsed' format
          if (encoding) {
            result.object = (result.object as Uint8Array).toString(encoding)
          } else {
            result.object = new Uint8Array(result.object as Uint8Array)
            result.format = 'content'
          }
          break
        case 'tag':
          result.object = GitAnnotatedTag.from(result.object as Uint8Array).parse()
          break
        default:
          throw new ObjectTypeError(
            result.oid,
            result.type,
            'blob|commit|tag|tree'
          )
      }
    } else if (result.format === 'deflated' || result.format === 'wrapped') {
      result.type = result.format
    }
    return result as ReadObjectResult
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.readObject'
    throw err
  }
}

