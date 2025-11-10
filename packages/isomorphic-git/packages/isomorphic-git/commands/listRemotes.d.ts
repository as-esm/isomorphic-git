/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {string} args.gitdir
 *
 * @returns {Promise<Array<{remote: string, url: string}>>}
 */
export function _listRemotes({ fs, gitdir }: {
    fs: import("../models/FileSystem.js").FileSystem;
    gitdir: string;
}): Promise<Array<{
    remote: string;
    url: string;
}>>;
