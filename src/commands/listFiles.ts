import { _readTree } from './readTree.ts'
// GitRefManager import removed - using src/git/refs/ functions instead
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * List files in the index or a commit
 */
export async function _listFiles({
  fs,
  gitdir,
  ref,
  cache,
}: {
  fs: FsClient
  gitdir: string
  ref?: string
  cache: Record<string, unknown>
}): Promise<string[]> {
  if (ref) {
    // Use direct resolveRef() for consistency
    const { resolveRef } = await import('../git/refs/readRef.ts')
    const oid = await resolveRef({ fs, gitdir, ref })
    const filenames: string[] = []
    await accumulateFilesFromOid({
      fs,
      cache,
      gitdir,
      oid,
      filenames,
      prefix: '',
    })
    return filenames
  } else {
    // Use Repository.readIndexDirect() for consistency
    const { Repository } = await import('../core-utils/Repository.ts')
    // When dir is undefined, gitdir must be provided
    if (!gitdir) {
      throw new Error('Either dir or gitdir is required for listFiles')
    }
    const repo = await Repository.open({ fs, dir: undefined, gitdir, cache, autoDetectConfig: true })
    const index = await repo.readIndexDirect(false) // Force fresh read
    // Filter out entries without paths and return sorted list
    // This handles edge cases where entries might not have paths set
    return index.entries
      .map(x => x.path)
      .filter((path): path is string => path !== undefined && path !== null && path !== '')
  }
}

async function accumulateFilesFromOid({
  fs,
  cache,
  gitdir,
  oid,
  filenames,
  prefix,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
  filenames: string[]
  prefix: string
}): Promise<void> {
  const { tree } = await _readTree({ fs, cache, gitdir, oid })
  // TODO: Use `walk` to do this. Should be faster.
  for (const entry of tree) {
    if (entry.type === 'tree') {
      await accumulateFilesFromOid({
        fs,
        cache,
        gitdir,
        oid: entry.oid,
        filenames,
        prefix: join(prefix, entry.path),
      })
    } else {
      filenames.push(join(prefix, entry.path))
    }
  }
}

