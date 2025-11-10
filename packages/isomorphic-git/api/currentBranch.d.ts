/**
 * Get the name of the branch currently pointed to by .git/HEAD
 *
 * @param {Object} args
 * @param {FileSystem} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {boolean} [args.fullname = false] - Return the full path (e.g. "refs/heads/main") instead of the abbreviated form.
 * @param {boolean} [args.test = false] - If the current branch doesn't actually exist (such as right after git init) then return `undefined`.
 *
 * @returns {Promise<string|void>} The name of the current branch or undefined if the HEAD is detached.
 *
 * @example
 * // Get the current branch name
 * let branch = await git.currentBranch({
 *   fs,
 *   dir: '/tutorial',
 *   fullname: false
 * })
 * console.log(branch)
 *
 */
export function currentBranch({ fs, dir, gitdir, fullname, test, }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    fullname?: boolean | undefined;
    test?: boolean | undefined;
}): Promise<string | void>;
import { FileSystem } from '../models/FileSystem.js';
