import { ObjectTypeError } from "../errors/ObjectTypeError.ts"
import { resolveRef } from "../git/refs/readRef.ts"
import { GitShallowManager } from "../managers/GitShallowManager.ts"
import { GitAnnotatedTag } from "../models/GitAnnotatedTag.ts"
import { GitCommit } from "../models/GitCommit.ts"
import { _readObject as readObject } from "../storage/readObject.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * @param {object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {any} args.cache
 * @param {string} [args.dir]
 * @param {string} args.gitdir
 * @param {Iterable<string>} args.start
 * @param {Iterable<string>} args.finish
 * @returns {Promise<Set<string>>}
 */
export async function listCommitsAndTags({
  fs,
  cache,
  dir = '',
  gitdir = join(dir, '.git'),
  start,
  finish,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  dir?: string
  gitdir?: string
  start: Iterable<string>
  finish: Iterable<string>
}): Promise<Set<string>> {
  const shallows = await GitShallowManager.read({ fs, gitdir })
  const startingSet = new Set<string>()
  const finishingSet = new Set<string>()
  for (const ref of start) {
    startingSet.add(await resolveRef({ fs, gitdir, ref }))
  }
  for (const ref of finish) {
    // We may not have these refs locally so we must try/catch
    try {
      const oid = await resolveRef({ fs, gitdir, ref })
      finishingSet.add(oid)
    } catch (err) {
      // Ignore errors for refs we don't have locally
    }
  }
  const visited = new Set<string>()
  // Because git commits are named by their hash, there is no
  // way to construct a cycle. Therefore we won't worry about
  // setting a default recursion limit.
  async function walk(oid: string): Promise<void> {
    visited.add(oid)
    const { type, object } = await readObject({ fs, cache, gitdir, oid })
    // Recursively resolve annotated tags
    if (type === 'tag') {
      const tag = GitAnnotatedTag.from(object)
      const commit = tag.headers().object
      return walk(commit)
    }
    if (type !== 'commit') {
      throw new ObjectTypeError(oid, type, 'commit')
    }
    if (!shallows.has(oid)) {
      const commit = GitCommit.from(object)
      const parents = commit.headers().parent
      for (const parentOid of parents) {
        if (!finishingSet.has(parentOid) && !visited.has(parentOid)) {
          await walk(parentOid)
        }
      }
    }
  }
  // Let's go walking!
  for (const oid of startingSet) {
    await walk(oid)
  }
  return visited
}

