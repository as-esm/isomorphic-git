import { MaxDepthError } from "../errors/MaxDepthError.ts"
import { MissingParameterError } from "../errors/MissingParameterError.ts"
import { ObjectTypeError } from "../errors/ObjectTypeError.ts"
import { GitShallowManager } from "../managers/GitShallowManager.ts"
import { GitCommit } from "../models/GitCommit.ts"
import { _readObject } from "../storage/readObject.ts"
import type { FsClient } from "../models/FileSystem.ts"

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
  const shallows = await GitShallowManager.read({ fs, gitdir })
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

