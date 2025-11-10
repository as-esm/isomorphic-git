/**
 * Write a tree object directly
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {TreeObject} args.tree - The object to write
 *
 * @returns {Promise<string>} Resolves successfully with the SHA-1 object id of the newly written object.
 * @see TreeObject
 * @see TreeEntry
 *
 */
export function writeTree({ fs, dir, gitdir, tree }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    tree: TreeObject;
}): Promise<string>;
import { FileSystem } from '../models/FileSystem.js';
