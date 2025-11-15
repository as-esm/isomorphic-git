import { SparseCheckoutManager } from "../core-utils/filesystem/SparseCheckoutManager.ts"
import { WorkdirManager } from "../core-utils/filesystem/WorkdirManager.ts"
import { RefManager } from "../core-utils/refs/RefManager.ts"
import { ObjectReader } from "../core-utils/odb/ObjectReader.ts"
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
  fs,
  dir,
  gitdir = join(dir, '.git'),
  set,
  list,
  init,
  cone = false,
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
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir)

    const _fs = normalizeFs(fs)

    // Use Repository when dir is available to get full config support (system/global config)
    let repo: Repository | undefined
    if (dir) {
      try {
        repo = await Repository.open({ fs, dir, cache, autoDetectConfig: true })
        // Use gitdir from Repository to ensure consistency
        const repoGitdir = await repo.getGitdir()
        if (repoGitdir !== gitdir) {
          gitdir = repoGitdir
        }
      } catch {
        // If Repository.open fails, continue with provided gitdir
      }
    }

    if (init) {
      // Use Repository's config if available, otherwise fall back to SparseCheckoutManager.init
      if (repo) {
        const configService = await repo.getConfig()
        await configService.set('core.sparseCheckout', 'true', 'local')
        if (cone) {
          await configService.set('core.sparseCheckoutCone', 'true', 'local')
        }
        // Create sparse-checkout file with default pattern (everything)
        await SparseCheckoutManager.set({ fs: _fs, gitdir, patterns: ['/*'], coneMode: cone })
      } else {
        await SparseCheckoutManager.init({ fs: _fs, gitdir, coneMode: cone })
      }

      // Update working directory based on new patterns
      try {
        const headOid = await RefManager.resolve({ fs: _fs, gitdir, ref: 'HEAD' })
        const { object: commitObject } = await ObjectReader.read({ fs: _fs, cache, gitdir, oid: headOid })
        const commit = parseCommit(commitObject)
        const patterns = await SparseCheckoutManager.loadPatterns({ fs: _fs, gitdir })
        
        if (repo) {
          // Use Repository.checkout for centralized cache and state management
          await repo.checkout({
            treeOid: commit.tree,
            sparsePatterns: patterns,
          })
        } else {
          // Fallback for backward compatibility
          await WorkdirManager.checkout({
            fs: _fs,
            dir,
            gitdir,
            treeOid: commit.tree,
            sparsePatterns: patterns,
            cache,
          })
        }
      } catch (err) {
        // No HEAD commit yet, that's okay
      }
    } else if (set) {
      await SparseCheckoutManager.set({ fs: _fs, gitdir, patterns: set, coneMode: cone })

      // Update working directory based on new patterns
      try {
        const headOid = await RefManager.resolve({ fs: _fs, gitdir, ref: 'HEAD' })
        const { object: commitObject } = await ObjectReader.read({ fs: _fs, cache, gitdir, oid: headOid })
        const commit = parseCommit(commitObject)
        
        if (repo) {
          // Use Repository.checkout for centralized cache and state management
          await repo.checkout({
            treeOid: commit.tree,
            sparsePatterns: set,
          })
        } else {
          // Fallback for backward compatibility
          await WorkdirManager.checkout({
            fs: _fs,
            dir,
            gitdir,
            treeOid: commit.tree,
            sparsePatterns: set,
            cache,
          })
        }
      } catch (err) {
        // No HEAD commit yet, that's okay
      }
    } else if (list) {
      return await SparseCheckoutManager.list({ fs: _fs, gitdir })
    } else {
      throw new Error('Must specify one of: init, set, or list')
    }
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.sparseCheckout'
    throw err
  }
}

