import { NotFoundError } from "../errors/NotFoundError.ts"
import { RefManager } from "../core-utils/refs/RefManager.ts"
import { ObjectReader } from "../core-utils/odb/ObjectReader.ts"
import { parse as parseCommit } from "../core-utils/parsers/Commit.ts"
import { parse as parseTree } from "../core-utils/parsers/Tree.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { ReadCommitResult } from "../models/GitCommit.ts"

/**
 * Get commit descriptions from the git history
 *
 * @param {object} args
 * @param {import('../types.js').FsClient} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string=} args.filepath optional get the commit for the filepath only
 * @param {string} args.ref
 * @param {number|void} args.depth
 * @param {boolean=} [args.force=false] do not throw error if filepath is not exist (works only for a single file). defaults to false
 * @param {boolean=} [args.follow=false] Continue listing the history of a file beyond renames (works only for a single file). defaults to false
 *
 * @returns {Promise<Array<ReadCommitResult>>} Resolves to an array of ReadCommitResult objects
 * @see ReadCommitResult
 * @see CommitObject
 *
 * @example
 * let commits = await git.log({ dir: '$input((/))', depth: $input((5)), ref: '$input((master))' })
 * console.log(commits)
 *
 */
export async function _log({
  fs,
  cache,
  gitdir,
  filepath,
  ref,
  depth,
  since,
  force,
  follow,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  filepath?: string
  ref: string
  depth?: number
  since?: Date
  force?: boolean
  follow?: boolean
}): Promise<ReadCommitResult[]> {
  const sinceTimestamp =
    typeof since === 'undefined'
      ? undefined
      : Math.floor(since.valueOf() / 1000)
  
  const commits: ReadCommitResult[] = []
  const oid = await RefManager.resolve({ fs, gitdir, ref })
  const visited = new Set<string>()
  const queue: string[] = [oid]
  
  // Helper to read commit
  async function readCommit(commitOid: string): Promise<ReadCommitResult> {
    const { object: commitObject } = await ObjectReader.read({ fs, cache, gitdir, oid: commitOid })
    const commit = parseCommit(commitObject)
    return {
      oid: commitOid,
      commit,
      payload: '', // Will be populated if needed
    }
  }
  
  // Helper to resolve filepath in tree
  async function resolveFilepathInTree(treeOid: string, path: string): Promise<string | null> {
    const parts = path.split('/').filter(Boolean)
    let currentTreeOid = treeOid
    
    for (const part of parts) {
      const { object: treeObject } = await ObjectReader.read({ fs, cache, gitdir, oid: currentTreeOid })
      const treeEntries = parseTree(treeObject)
      const entry = treeEntries.find(e => e.path === part)
      if (!entry) return null
      if (entry.type === 'tree') {
        currentTreeOid = entry.oid
      } else {
        return entry.oid
      }
    }
    return currentTreeOid
  }
  
  while (queue.length > 0 && (depth === undefined || commits.length < depth)) {
    const commitOid = queue.shift()!
    if (visited.has(commitOid)) continue
    visited.add(commitOid)
    
    const commitData = await readCommit(commitOid)
    const commit = commitData.commit
    
    // Stop the log if we've hit the age limit
    if (
      sinceTimestamp !== undefined &&
      commit.committer.timestamp <= sinceTimestamp
    ) {
      break
    }
    
    // Filter by filepath if specified
    if (filepath) {
      try {
        const fileOid = await resolveFilepathInTree(commit.tree, filepath)
        if (fileOid) {
          commits.push(commitData)
        }
      } catch (e) {
        if (!force && !follow) {
          // File doesn't exist in this commit
          continue
        }
      }
    } else {
      commits.push(commitData)
    }
    
    // Add parents to queue
    for (const parentOid of commit.parent) {
      if (!visited.has(parentOid)) {
        queue.push(parentOid)
      }
    }
  }
  
  return commits
}

