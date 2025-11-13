import { ObjectTypeError } from '../errors/ObjectTypeError.js'
import { read as readObject } from '../core-utils/odb/ObjectReader.js'
import { parse as parseTag } from '../core-utils/parsers/Tag.js'
import { parse as parseCommit } from '../core-utils/parsers/Commit.js'
import { parse as parseTree } from '../core-utils/parsers/Tree.js'
import { parse as parseBlob } from '../core-utils/parsers/Blob.js'
import { GitTree } from '../models/GitTree.js'
import type { FsClient } from '../models/FileSystem.js'
import type { TagObject } from '../models/GitAnnotatedTag.js'
import type { CommitObject } from '../models/GitCommit.js'

/**
 * Generic object resolver that handles tag peeling and type checking
 * Reduces redundancy across resolveBlob, resolveCommit, resolveTree
 */
export async function resolveObject<T>(
  {
    fs,
    cache,
    gitdir,
    oid,
    expectedType,
    parser,
    emptyTreeOid,
  }: {
    fs: FsClient
    cache: Record<string, unknown>
    gitdir: string
    oid: string
    expectedType: 'blob' | 'commit' | 'tree'
    parser: (object: Buffer) => T
    emptyTreeOid?: string
  }
): Promise<{ oid: string; object: T }> {
  // Handle empty tree special case
  if (expectedType === 'tree' && oid === (emptyTreeOid || '4b825dc642cb6eb9a060e54bf8d69288fbee4904')) {
    // Empty tree is represented as an empty array
    const emptyTreeBuffer = Buffer.from('tree 0\x00')
    return { oid, object: parser(emptyTreeBuffer) }
  }

  const result = await readObject({ fs, cache, gitdir, oid, format: 'content' })

  // Handle tag peeling
  if (result.type === 'tag') {
    const tag = parseTag(result.object) as TagObject
    return resolveObject({
      fs,
      cache,
      gitdir,
      oid: tag.object,
      expectedType,
      parser,
      emptyTreeOid,
    })
  }

  // Handle commit -> tree resolution
  if (expectedType === 'tree' && result.type === 'commit') {
    const commit = parseCommit(result.object) as CommitObject
    return resolveObject({
      fs,
      cache,
      gitdir,
      oid: commit.tree || '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
      expectedType,
      parser,
      emptyTreeOid,
    })
  }

  // Type check
  if (result.type !== expectedType) {
    throw new ObjectTypeError(oid, result.type, expectedType)
  }

  return { oid, object: parser(result.object) }
}

