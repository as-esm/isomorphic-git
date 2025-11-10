/**
 * Test whether a filepath should be ignored (because of .gitignore or .git/exclude)
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {string} args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.filepath - The filepath to test
 *
 * @returns {Promise<boolean>} Resolves to true if the file should be ignored
 *
 * @example
 * await git.isIgnored({ fs, dir: '/tutorial', filepath: 'docs/add.md' })
 *
 */
export function isIgnored({ fs, dir, gitdir, filepath, }: {
    fs: FileSystem;
    dir: string;
    gitdir?: string | undefined;
    filepath: string;
}): Promise<boolean>;
import { FileSystem } from '../models/FileSystem.js';
