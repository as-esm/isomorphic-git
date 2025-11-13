import { _findMergeBase } from '../commands/findMergeBase.js'
import { normalizeFs } from '../utils/normalizeFs.js'
import { assertParameter } from '../utils/assertParameter.js'
import { join } from '../utils/join.js'
import type { FsClient } from '../models/FileSystem.js'

/**
 * Find the merge base for a set of commits
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string[]} args.oids - Which commits
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 */
export async function findMergeBase({
  fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  oids,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  oids: string[]
  cache?: Record<string, unknown>
}): Promise<string> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir!)
    assertParameter('oids', oids)

    const result = await _findMergeBase({
      fs: normalizeFs(fs) as any,
      cache,
      gitdir: gitdir!,
      oids,
    })
    return Array.isArray(result) ? result[0] : result
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.findMergeBase'
    throw err
  }
}

