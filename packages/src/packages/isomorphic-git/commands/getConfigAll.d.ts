/**
 * @param {Object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {string} args.gitdir
 * @param {string} args.path
 *
 * @returns {Promise<Array<any>>} Resolves with an array of the config value
 *
 */
export function _getConfigAll({ fs, gitdir, path }: {
    fs: import("../models/FileSystem.js").FileSystem;
    gitdir: string;
    path: string;
}): Promise<Array<any>>;
