/**
 * List remotes
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 *
 * @returns {Promise<Array<{remote: string, url: string}>>} Resolves successfully with an array of `{remote, url}` objects
 *
 * @example
 * let remotes = await git.listRemotes({ fs, dir: '/tutorial' })
 * console.log(remotes)
 *
 */
export function listRemotes({ fs, dir, gitdir }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
}): Promise<Array<{
    remote: string;
    url: string;
}>>;
import { FileSystem } from '../models/FileSystem.js';
