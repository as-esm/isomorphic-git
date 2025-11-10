/**
 * Removes the local config entry for a given remote
 *
 * @param {Object} args
 * @param {FileSystem} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.remote - The name of the remote to delete
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.deleteRemote({ fs, dir: '/tutorial', remote: 'upstream' })
 * console.log('done')
 *
 */
export function deleteRemote({ fs, dir, gitdir, remote, }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    remote: string;
}): Promise<void>;
import { FileSystem } from '../models/FileSystem.js';
