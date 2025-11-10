/**
 * @param {Object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {string} args.gitdir
 * @param {string} args.ref
 *
 * @returns {Promise<void>}
 */
export function _deleteBranch({ fs, gitdir, ref }: {
    fs: import("../models/FileSystem.js").FileSystem;
    gitdir: string;
    ref: string;
}): Promise<void>;
