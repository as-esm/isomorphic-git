/**
 * List refs
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.filepath] - [required] The refs path to list
 *
 * @returns {Promise<Array<string>>} Resolves successfully with an array of ref names below the supplied `filepath`
 *
 * @example
 * let refs = await git.listRefs({ fs, dir: '/tutorial', filepath: 'refs/heads' })
 * console.log(refs)
 *
 */
export function listRefs({ fs, dir, gitdir, filepath, }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    filepath?: string | undefined;
}): Promise<Array<string>>;
import { FileSystem } from '../models/FileSystem.js';
