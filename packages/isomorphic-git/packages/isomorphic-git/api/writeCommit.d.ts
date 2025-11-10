/**
 * Write a commit object directly
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {CommitObject} args.commit - The object to write
 *
 * @returns {Promise<string>} Resolves successfully with the SHA-1 object id of the newly written object
 * @see CommitObject
 *
 */
export function writeCommit({ fs, dir, gitdir, commit, }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    commit: CommitObject;
}): Promise<string>;
import { FileSystem } from '../models/FileSystem.js';
