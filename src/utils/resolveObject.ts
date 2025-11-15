import { ObjectTypeError } from '../errors/ObjectTypeError.ts'
import { NotFoundError } from '../errors/NotFoundError.ts'
import { read as readObject } from "../core-utils/odb/ObjectReader.ts"
import { parse as parseTag } from "../core-utils/parsers/Tag.ts"
import { parse as parseCommit } from "../core-utils/parsers/Commit.ts"
import { parse as parseTree } from "../core-utils/parsers/Tree.ts"
import { parse as parseBlob } from "../core-utils/parsers/Blob.ts"
import { GitTree } from "../models/GitTree.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { TagObject } from "../models/GitAnnotatedTag.ts"
import type { CommitObject } from "../models/GitCommit.ts"

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

  let result: any
  try {
    result = await readObject({ fs, cache, gitdir, oid, format: 'content' })
  } catch (error) {
    // If we're looking for a tree and it doesn't exist, fall back to empty tree
    // This handles cases where tree objects are missing from the repository
    if (expectedType === 'tree' && error instanceof NotFoundError) {
      const emptyTreeBuffer = Buffer.from('tree 0\x00')
      return { oid: emptyTreeOid || '4b825dc642cb6eb9a060e54bf8d69288fbee4904', object: parser(emptyTreeBuffer) }
    }
    throw error
  }

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
    const treeOid = commit.tree || '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
    try {
      return await resolveObject({
        fs,
        cache,
        gitdir,
        oid: treeOid,
        expectedType,
        parser,
        emptyTreeOid,
      })
    } catch (error) {
      // If the commit's tree doesn't exist, fall back to empty tree
      // This can happen in repositories where objects weren't fully written
      if (error instanceof NotFoundError && treeOid !== (emptyTreeOid || '4b825dc642cb6eb9a060e54bf8d69288fbee4904')) {
        const emptyTreeBuffer = Buffer.from('tree 0\x00')
        return { oid: emptyTreeOid || '4b825dc642cb6eb9a060e54bf8d69288fbee4904', object: parser(emptyTreeBuffer) }
      }
      throw error
    }
  }

  // Type check
  if (result.type !== expectedType) {
    throw new ObjectTypeError(oid, result.type, expectedType)
  }

  return { oid, object: parser(result.object) }
}

