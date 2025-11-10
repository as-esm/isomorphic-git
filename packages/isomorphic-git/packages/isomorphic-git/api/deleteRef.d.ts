/**
 * Delete a local ref
 *
 * @param {Object} args
 * @param {FileSystem} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - The ref to delete
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.deleteRef({ fs, dir: '/tutorial', ref: 'refs/tags/test-tag' })
 * console.log('done')
 *
 */
export function deleteRef({ fs, dir, gitdir, ref }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    ref: string;
}): Promise<void>;
import { FileSystem } from '../models/FileSystem.js';
