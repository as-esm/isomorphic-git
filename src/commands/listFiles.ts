import { _readTree } from './readTree.js'
import { GitIndexManager } from '../managers/GitIndexManager.js'
import { GitRefManager } from '../managers/GitRefManager.js'
import { join } from '../utils/join.js'
import type { FsClient } from '../models/FileSystem.js'

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
    const oid = await GitRefManager.resolve({ gitdir, fs, ref })
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
    return GitIndexManager.acquire(
      { fs, gitdir, cache },
      async function (index) {
        return index.entries.map(x => x.path)
      }
    )
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

