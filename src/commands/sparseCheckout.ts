import { SparseCheckoutManager } from "../core-utils/filesystem/SparseCheckoutManager.ts"
import { WorkdirManager } from "../core-utils/filesystem/WorkdirManager.ts"
import { readObject } from "../git/objects/readObject.ts"
import { parse as parseCommit } from "../core-utils/parsers/Commit.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { Repository } from "../core-utils/Repository.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Manage sparse checkout patterns
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string[]} [args.set] - Set sparse checkout patterns
 * @param {boolean} [args.list] - List current sparse checkout patterns
 * @param {boolean} [args.init] - Initialize sparse checkout
 * @param {boolean} [args.cone] - Use cone mode (only with init or set)
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<string[]|void>} If list is true, returns array of patterns. Otherwise returns void.
 *
 * @example
 * // Initialize sparse checkout
 * await git.sparseCheckout({ fs, dir: '/tutorial', init: true, cone: true })
 *
 * // Set patterns
 * await git.sparseCheckout({ fs, dir: '/tutorial', set: ['src/', 'docs/'] })
 *
 * // List patterns
 * const patterns = await git.sparseCheckout({ fs, dir: '/tutorial', list: true })
 * console.log(patterns)
 *
 */
export async function sparseCheckout({
  fs: _fs,
  dir,
  gitdir: _gitdir,
  set,
  list,
  init,
  cone,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  set?: string[]
  list?: boolean
  init?: boolean
  cone?: boolean
  cache?: Record<string, unknown>
}): Promise<string[] | void> {
  try {
    assertParameter('fs', _fs)
    // dir is required for checkout operations, which init and set perform
    if ((init || set) && !dir) {
      throw new Error('The "dir" argument is required for sparseCheckout init or set operations.')
    }
    const gitdir = _gitdir || (dir ? join(dir, '.git') : undefined)
    assertParameter('gitdir', gitdir)

    const fs = normalizeFs(_fs)
    const repo = await Repository.open({ fs: _fs, dir, gitdir, cache, autoDetectConfig: true })
    const effectiveGitdir = await repo.getGitdir()
    
    // This function will re-apply the checkout based on the current sparse-checkout file
    const reapplyCheckout = async (patterns: string[], isCone: boolean) => {
      try {
        const headOid = await repo.resolveRef('HEAD')
        const { object: commitObject } = await readObject({ fs, cache, gitdir: effectiveGitdir, oid: headOid })
        const commit = parseCommit(commitObject)
        
        // FIX: Use the correct low-level WorkdirManager.checkout which accepts a treeOid.
        // This is the main bug fix. It ensures both the workdir AND the index are updated.
        // Use force: true to ensure files that don't match sparse patterns are removed
        // from both the working directory and the index.
        await WorkdirManager.checkout({
          fs,
          dir: dir!,
          gitdir: effectiveGitdir,
          treeOid: commit.tree,
          sparsePatterns: patterns,
          force: true,
          cache,
          // We don't need to pass coneMode here as WorkdirManager.checkout will
          // read it from the config via SparseCheckoutManager internally.
        })
      } catch (err) {
        if ((err as any).code === 'NotFoundError' && (err as any).data?.what === 'HEAD') {
          // This is a fresh repo with no commits. Nothing to check out.
          return
        }
        throw err
      }
    }

    if (init) {
      const isCone = cone !== undefined ? cone : false
      await SparseCheckoutManager.init({ fs, gitdir: effectiveGitdir, coneMode: isCone })
      // After init, apply the default sparse patterns ("/*") to the workdir.
      await reapplyCheckout(['/*'], isCone)
    } else if (set) {
      // Determine if cone mode should be used. Prioritize the function argument, then config.
      const isCone = cone !== undefined ? cone : await SparseCheckoutManager.isConeMode({ fs, gitdir: effectiveGitdir })
      await SparseCheckoutManager.set({ fs, gitdir: effectiveGitdir, patterns: set, coneMode: isCone })
      // After setting new patterns, re-apply the checkout.
      await reapplyCheckout(set, isCone)
    } else if (list) {
      return await SparseCheckoutManager.list({ fs, gitdir: effectiveGitdir })
    } else {
      throw new Error('Must specify one of: init, set, or list')
    }
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.sparseCheckout'
    throw err
  }
}

