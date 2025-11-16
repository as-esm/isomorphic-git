import { GitCommit } from "../models/GitCommit.ts"
import { readObject } from "../git/objects/readObject.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

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
    // Return first result if array, or undefined if empty array, or the result itself if not an array
    if (Array.isArray(result)) {
      return result.length > 0 ? result[0] : undefined
    }
    return result
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.findMergeBase'
    throw err
  }
}

/**
 * Find the merge base of multiple commits
 */
export async function _findMergeBase({
  fs,
  cache,
  gitdir,
  oids,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oids: string[]
}): Promise<string[]> {
  // Note: right now, the tests are geared so that the output should match that of
  // `git merge-base --all --octopus`
  // because without the --octopus flag, git's output seems to depend on the ORDER of the oids,
  // and computing virtual merge bases is just too much for me to fathom right now.

  // If we start N independent walkers, one at each of the given `oids`, and walk backwards
  // through ancestors, eventually we'll discover a commit where each one of these N walkers
  // has passed through. So we just need to keep track of which walkers have visited each commit
  // until we find a commit that N distinct walkers has visited.
  const visits: Record<string, Set<number>> = {}
  const passes = oids.length
  let heads: Array<{ index: number; oid: string }> = oids.map((oid, index) => ({ index, oid }))
  while (heads.length) {
    // Count how many times we've passed each commit
    const result = new Set<string>()
    for (const { oid, index } of heads) {
      if (!visits[oid]) visits[oid] = new Set()
      visits[oid].add(index)
      if (visits[oid].size === passes) {
        result.add(oid)
      }
    }
    if (result.size > 0) {
      return [...result]
    }
    // We haven't found a common ancestor yet
    const newheads = new Map<string, { oid: string; index: number }>()
    for (const { oid, index } of heads) {
      try {
        const { object } = await readObject({ fs, cache, gitdir, oid })
        const commit = GitCommit.from(object)
        const { parent } = commit.parseHeaders()
        for (const parentOid of parent) {
          if (!visits[parentOid] || !visits[parentOid].has(index)) {
            newheads.set(parentOid + ':' + index, { oid: parentOid, index })
          }
        }
      } catch (err) {
        // do nothing
      }
    }
    heads = Array.from(newheads.values())
  }
  return []
}

