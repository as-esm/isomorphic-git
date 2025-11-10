/**
 * Create a branch
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - What to name the branch
 * @param {string} [args.object = 'HEAD'] - What oid to use as the start point. Accepts a symbolic ref.
 * @param {boolean} [args.checkout = false] - Update `HEAD` to point at the newly created branch
 * @param {boolean} [args.force = false] - Instead of throwing an error if a branched named `ref` already exists, overwrite the existing branch.
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.branch({ fs, dir: '/tutorial', ref: 'develop' })
 * console.log('done')
 *
 */
export function branch({ fs, dir, gitdir, ref, object, checkout, force, }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    ref: string;
    object?: string | undefined;
    checkout?: boolean | undefined;
    force?: boolean | undefined;
}): Promise<void>;
import { FileSystem } from '../models/FileSystem.js';
