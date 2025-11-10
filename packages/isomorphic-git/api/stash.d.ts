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
 * @param {FileSystem} args.fs - [required] a file system client
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
export function stash({ fs, dir, gitdir, op, message, refIdx, }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    op?: "push" | "pop" | "apply" | "drop" | "list" | "clear" | "create" | undefined;
    message?: string | undefined;
    refIdx?: number | undefined;
}): Promise<string | void>;
import { FileSystem } from '../models/FileSystem.js';
