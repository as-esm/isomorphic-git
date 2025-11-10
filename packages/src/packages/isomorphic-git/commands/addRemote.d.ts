/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {string} args.gitdir
 * @param {string} args.remote
 * @param {string} args.url
 * @param {boolean} args.force
 *
 * @returns {Promise<void>}
 *
 */
export function _addRemote({ fs, gitdir, remote, url, force }: {
    fs: import("../models/FileSystem.js").FileSystem;
    gitdir: string;
    remote: string;
    url: string;
    force: boolean;
}): Promise<void>;
