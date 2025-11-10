/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {string} args.gitdir
 * @param {TreeObject} args.tree
 *
 * @returns {Promise<string>}
 */
export function _writeTree({ fs, gitdir, tree }: {
    fs: import("../models/FileSystem.js").FileSystem;
    gitdir: string;
    tree: TreeObject;
}): Promise<string>;
