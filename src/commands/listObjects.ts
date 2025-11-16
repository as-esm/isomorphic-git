import { GitAnnotatedTag } from "../models/GitAnnotatedTag.ts"
import { GitCommit } from "../models/GitCommit.ts"
import { GitTree } from "../models/GitTree.ts"
import { readObject } from "../git/objects/readObject.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * @param {object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {any} args.cache
 * @param {string} [args.dir]
 * @param {string} args.gitdir
 * @param {Iterable<string>} args.oids
 * @returns {Promise<Set<string>>}
 */
export async function listObjects({
  fs,
  cache,
  dir,
  gitdir = join(dir, '.git'),
  oids,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  dir?: string
  gitdir?: string
  oids: Iterable<string>
}): Promise<Set<string>> {
  const visited = new Set<string>()
  // We don't do the purest simplest recursion, because we can
  // avoid reading Blob objects entirely since the Tree objects
  // tell us which oids are Blobs and which are Trees.
  async function walk(oid: string): Promise<void> {
    if (visited.has(oid)) return
    visited.add(oid)
    const { type, object } = await readObject({ fs, cache, gitdir, oid })
    if (type === 'tag') {
      const tag = GitAnnotatedTag.from(object)
      const obj = tag.headers().object
      await walk(obj)
    } else if (type === 'commit') {
      const commit = GitCommit.from(object)
      const tree = commit.headers().tree
      await walk(tree)
    } else if (type === 'tree') {
      const tree = GitTree.from(object)
      for (const entry of tree) {
        // add blobs to the set
        // skip over submodules whose type is 'commit'
        if (entry.type === 'blob') {
          visited.add(entry.oid)
        }
        // recurse for trees
        if (entry.type === 'tree') {
          await walk(entry.oid)
        }
      }
    }
  }
  // Let's go walking!
  for (const oid of oids) {
    await walk(oid)
  }
  return visited
}

