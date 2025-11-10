/**
 * @param {Object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {string} args.gitdir
 * @param {string} args.remote
 *
 * @returns {Promise<void>}
 */
export function _deleteRemote({ fs, gitdir, remote }: {
    fs: import("../models/FileSystem.js").FileSystem;
    gitdir: string;
    remote: string;
}): Promise<void>;
