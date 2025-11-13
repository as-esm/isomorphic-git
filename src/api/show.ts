import { RefManager } from '../core-utils/refs/RefManager.js'
import { read as readObject } from '../core-utils/odb/ObjectReader.js'
import { parse as parseCommit } from '../core-utils/parsers/Commit.js'
import { parse as parseTree } from '../core-utils/parsers/Tree.js'
import { parse as parseTag } from '../core-utils/parsers/Tag.js'
import { parse as parseBlob } from '../core-utils/parsers/Blob.js'
import { resolveFilepath } from '../utils/resolveFilepath.js'
import { assertParameter } from '../utils/assertParameter.js'
import { Repository } from '../core-utils/Repository.js'
import { join } from '../utils/join.js'
import type { FsClient } from '../models/FileSystem.js'

// ============================================================================
// SHOW TYPES
// ============================================================================

/**
 * Show operation result
 */
export type ShowResult = {
  oid: string
  type: 'commit' | 'tree' | 'blob' | 'tag'
  object: unknown
  filepath?: string
}

/**
 * Show various types of objects (commits, trees, blobs, tags)
 * Similar to `git show`, displays the object in a human-readable format
 */
export async function show({
  fs: _fs,
  dir,
  gitdir: _gitdir,
  ref = 'HEAD',
  filepath,
  cache: _cache,
  repo,
}: {
  fs?: FsClient
  dir?: string
  gitdir?: string
  ref?: string
  filepath?: string
  cache?: Record<string, unknown>
  repo?: Repository
}): Promise<ShowResult> {
  try {
    // Extract parameters from Repository if provided
    const fs = repo?.fs || _fs!
    const cache = repo?.cache || _cache || {}
    const gitdir = _gitdir || (repo ? await repo.getGitdir() : (dir ? join(dir, '.git') : undefined))
    
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir)
    assertParameter('ref', ref)

    // Resolve ref to OID
    let oid: string
    try {
      oid = await RefManager.resolve({ fs, gitdir, ref })
    } catch (err) {
      // If ref resolution fails, try treating it as an OID directly
      if (ref.length === 40 && /^[0-9a-f]{40}$/i.test(ref)) {
        oid = ref
      } else {
        throw err
      }
    }

    // If filepath is provided, resolve it to a blob
    if (filepath !== undefined) {
      const blobOid = await resolveFilepath({ fs, cache, gitdir, oid, filepath })
      const blobResult = await readObject({ fs, cache, gitdir, oid: blobOid, format: 'content' })
      const blob = parseBlob(blobResult.object)
      
      return {
        oid: blobOid,
        type: 'blob',
        object: blob,
        filepath,
      }
    }

    // Read the object
    const result = await readObject({ fs, cache, gitdir, oid, format: 'content' })

    // Parse based on type
    switch (result.type) {
      case 'commit': {
        const commit = parseCommit(result.object)
        return {
          oid: result.oid || oid,
          type: 'commit',
          object: commit,
        }
      }
      case 'tree': {
        const tree = parseTree(result.object)
        return {
          oid: result.oid || oid,
          type: 'tree',
          object: tree,
        }
      }
      case 'blob': {
        const blob = parseBlob(result.object)
        return {
          oid: result.oid || oid,
          type: 'blob',
          object: blob,
        }
      }
      case 'tag': {
        const tag = parseTag(result.object)
        return {
          oid: result.oid || oid,
          type: 'tag',
          object: tag,
        }
      }
      default:
        throw new Error(`Unknown object type: ${result.type}`)
    }
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.show'
    throw err
  }
}

