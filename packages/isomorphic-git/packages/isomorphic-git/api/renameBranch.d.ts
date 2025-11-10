/**
 * Rename a branch
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - What to name the branch
 * @param {string} args.oldref - What the name of the branch was
 * @param {boolean} [args.checkout = false] - Update `HEAD` to point at the newly created branch
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.renameBranch({ fs, dir: '/tutorial', ref: 'main', oldref: 'master' })
 * console.log('done')
 *
 */
export function renameBranch({ fs, dir, gitdir, ref, oldref, checkout, }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    ref: string;
    oldref: string;
    checkout?: boolean | undefined;
}): Promise<void>;
import { FileSystem } from '../models/FileSystem.js';
