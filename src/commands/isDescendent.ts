import { MaxDepthError } from "../errors/MaxDepthError.ts"
import { MissingParameterError } from "../errors/MissingParameterError.ts"
import { ObjectTypeError } from "../errors/ObjectTypeError.ts"
import { readShallow } from "../git/shallow.ts"
import { GitCommit } from "../models/GitCommit.ts"
import { readObject as _readObject } from "../git/objects/readObject.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Check whether a git commit is descended from another
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.oid - The descendent commit
 * @param {string} args.ancestor - The (proposed) ancestor commit
 * @param {number} [args.depth = -1] - Maximum depth to search before giving up. -1 means no maximum depth.
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<boolean>} Resolves to true if `oid` is a descendent of `ancestor`
 *
 * @example
 * let oid = await git.resolveRef({ fs, dir: '/tutorial', ref: 'main' })
 * let ancestor = await git.resolveRef({ fs, dir: '/tutorial', ref: 'v0.20.0' })
 * console.log(oid, ancestor)
 * await git.isDescendent({ fs, dir: '/tutorial', oid, ancestor, depth: -1 })
 *
 */
export async function isDescendent({
  fs,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  oid,
  ancestor,
  depth = -1,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  oid: string
  ancestor: string
  depth?: number
  cache?: Record<string, unknown>
}): Promise<boolean> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir!)
    assertParameter('oid', oid)
    assertParameter('ancestor', ancestor)

    return await _isDescendent({
      fs: normalizeFs(fs) as any,
      cache,
      gitdir: gitdir!,
      oid,
      ancestor,
      depth,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.isDescendent'
    throw err
  }
}

/**
 * Check if a commit is a descendent of another commit
 */
export async function _isDescendent({
  fs,
  cache,
  gitdir,
  oid,
  ancestor,
  depth,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
  ancestor: string
  depth: number
}): Promise<boolean> {
  const shallows = await readShallow({ fs, gitdir })
  if (!oid) {
    throw new MissingParameterError('oid')
  }
  if (!ancestor) {
    throw new MissingParameterError('ancestor')
  }
  // If you don't like this behavior, add your own check.
  // Edge cases are hard to define a perfect solution.
  if (oid === ancestor) return false
  // We do not use recursion here, because that would lead to depth-first traversal,
  // and we want to maintain a breadth-first traversal to avoid hitting shallow clone depth cutoffs.
  const queue: string[] = [oid]
  const visited = new Set<string>()
  let searchdepth = 0
  while (queue.length) {
    if (depth !== -1 && searchdepth++ === depth) {
      throw new MaxDepthError(depth)
    }
    const currentOid = queue.shift()
    if (!currentOid) break
    const { type, object } = await _readObject({
      fs,
      cache,
      gitdir,
      oid: currentOid,
    })
    if (type !== 'commit') {
      throw new ObjectTypeError(currentOid, type, 'commit')
    }
    const commit = GitCommit.from(object).parse()
    // Are any of the parents the sought-after ancestor?
    for (const parent of commit.parent) {
      if (parent === ancestor) return true
    }
    // If not, add them to heads (unless we know this is a shallow commit)
    if (!shallows.has(currentOid)) {
      for (const parent of commit.parent) {
        if (!visited.has(parent)) {
          queue.push(parent)
          visited.add(parent)
        }
      }
    }
    // Eventually, we'll travel entire tree to the roots where all the parents are empty arrays,
    // or hit the shallow depth and throw an error. Excluding the possibility of grafts, or
    // different branches cloned to different depths, you would hit this error at the same time
    // for all parents, so trying to continue is futile.
  }
  return false
}

