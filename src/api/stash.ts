import {
  _stashPush,
  _stashApply,
  _stashDrop,
  _stashList,
  _stashClear,
  _stashPop,
  _stashCreate,
} from '../commands/stash.ts'
import { InvalidRefNameError } from "../errors/InvalidRefNameError.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { Repository } from "../core-utils/Repository.ts"
import type { FsClient } from "../models/FileSystem.ts"

// ============================================================================
// STASH TYPES
// ============================================================================

/**
 * Stash operation type
 */
export type StashOp = 'push' | 'pop' | 'apply' | 'drop' | 'list' | 'clear' | 'create'

/**
 * Stash change type
 */
export type StashChangeType = 'equal' | 'modify' | 'add' | 'remove' | 'unknown'

/**
 * stash api, supports  {'push' | 'pop' | 'apply' | 'drop' | 'list' | 'clear' | 'create'} StashOp
 * _note_,
 * - all stash operations are done on tracked files only with loose objects, no packed objects
 * - when op === 'push', both working directory and index (staged) changes will be stashed, tracked files only
 * - when op === 'push', message is optional, and only applicable when op === 'push'
 * - when op === 'apply | pop', the stashed changes will overwrite the working directory, no abort when conflicts
 * - when op === 'create', creates a stash commit without modifying working directory or refs, returns the commit hash
 *
 * @param {object} args
 * @param {FsClient} args.fs - [required] a file system client
 * @param {string} [args.dir] - [required] The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [optional] The [git directory](dir-vs-gitdir.md) path
 * @param {'push' | 'pop' | 'apply' | 'drop' | 'list' | 'clear' | 'create'} [args.op = 'push'] - [optional] name of stash operation, default to 'push'
 * @param {string} [args.message = ''] - [optional] message to be used for the stash entry, only applicable when op === 'push' or 'create'
 * @param {number} [args.refIdx = 0] - [optional - Number] stash ref index of entry, only applicable when op === ['apply' | 'drop' | 'pop'], refIdx >= 0 and < num of stash pushed
 * @returns {Promise<string | void>}  Resolves successfully when stash operations are complete. Returns commit hash for 'create' operation.
 *
 * @example
 * // stash changes in the working directory and index
 * let dir = '/tutorial'
 * await fs.promises.writeFile(`${dir}/a.txt`, 'original content - a')
 * await fs.promises.writeFile(`${dir}/b.js`, 'original content - b')
 * await git.add({ fs, dir, filepath: [`a.txt`,`b.txt`] })
 * let sha = await git.commit({
 *   fs,
 *   dir,
 *   author: {
 *     name: 'Mr. Stash',
 *     email: 'mstasher@stash.com',
 *   },
 *   message: 'add a.txt and b.txt to test stash'
 * })
 * console.log(sha)
 *
 * await fs.promises.writeFile(`${dir}/a.txt`, 'stashed chang- a')
 * await git.add({ fs, dir, filepath: `${dir}/a.txt` })
 * await fs.promises.writeFile(`${dir}/b.js`, 'work dir change. not stashed - b')
 *
 * await git.stash({ fs, dir }) // default gitdir and op
 *
 * console.log(await git.status({ fs, dir, filepath: 'a.txt' })) // 'unmodified'
 * console.log(await git.status({ fs, dir, filepath: 'b.txt' })) // 'unmodified'
 *
 * const refLog = await git.stash({ fs, dir, op: 'list' })
 * console.log(refLog) // [{stash{#} message}]
 *
 * await git.stash({ fs, dir, op: 'apply' }) // apply the stash
 *
 * console.log(await git.status({ fs, dir, filepath: 'a.txt' })) // 'modified'
 * console.log(await git.status({ fs, dir, filepath: 'b.txt' })) // '*modified'
 *
 * // create a stash commit without modifying working directory
 * const stashCommitHash = await git.stash({ fs, dir, op: 'create', message: 'my stash' })
 * console.log(stashCommitHash) // returns the stash commit hash
 */
export type StashOp = 'push' | 'pop' | 'apply' | 'drop' | 'list' | 'clear' | 'create'

export async function stash({
  fs,
  dir,
  gitdir = join(dir, '.git'),
  op = 'push',
  message = '',
  refIdx = 0,
  cache = {},
}: {
  fs: FsClient
  dir: string
  gitdir?: string
  op?: StashOp
  message?: string
  refIdx?: number
  cache?: Record<string, unknown>
}): Promise<string | void> {
  assertParameter('fs', fs)
  assertParameter('dir', dir)
  assertParameter('gitdir', gitdir)
  assertParameter('op', op)

  const stashMap: Record<StashOp, Function> = {
    push: _stashPush,
    apply: _stashApply,
    drop: _stashDrop,
    list: _stashList,
    clear: _stashClear,
    pop: _stashPop,
    create: _stashCreate,
  }

  const opsNeedRefIdx: StashOp[] = ['apply', 'drop', 'pop']

  try {
    // Use Repository to ensure consistent context and error handling
    // IMPORTANT: Use the provided cache directly to ensure add() and stash() share the same cache
    // Don't overwrite cache with repo.cache - Repository.open uses the provided cache if given
    // CRITICAL: Don't overwrite gitdir - use the provided gitdir to ensure we read config from the correct location
    // Repository.open() might find a different gitdir if dir is not the exact working directory
    let repo: Repository | undefined
    try {
      // Use the provided gitdir if available, otherwise let Repository.open() find it
      if (gitdir) {
        // Create Repository with explicit gitdir to avoid _findRoot() finding wrong path
        repo = new (await import('../core-utils/Repository.ts')).Repository(fs, dir, gitdir, cache, undefined, undefined)
      } else {
        repo = await Repository.open({ fs, dir, cache, autoDetectConfig: true })
        gitdir = await repo.getGitdir()
      }
      // Don't overwrite cache - Repository uses the provided cache, so repo.cache === cache
      // This ensures add() and stash() use the same cache instance
    } catch {
      // If Repository.open fails, continue with provided gitdir
    }

    const _fs = normalizeFs(fs)
    const folders = ['refs', 'logs', 'logs/refs']
    await Promise.all(
      folders
        .map(f => join(gitdir, f))
        .map(async folder => {
          if (!(await _fs.exists(folder))) {
            await _fs.mkdir(folder)
          }
        })
    )

    const opFunc = stashMap[op]
    if (opFunc) {
      if (opsNeedRefIdx.includes(op) && refIdx < 0) {
        throw new InvalidRefNameError(
          `stash@${refIdx}`,
          'number that is in range of [0, num of stash pushed]'
        )
      }
      return await opFunc({ fs: _fs, dir, gitdir, message, refIdx, cache, repo })
    }
    throw new Error(`To be implemented: ${op}`)
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.stash'
    throw err
  }
}

