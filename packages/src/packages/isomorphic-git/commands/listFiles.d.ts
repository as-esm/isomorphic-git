/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {object} args.cache
 * @param {string} args.gitdir
 * @param {string} [args.ref]
 *
 * @returns {Promise<Array<string>>}
 */
export function _listFiles({ fs, gitdir, ref, cache }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: object;
    gitdir: string;
    ref?: string | undefined;
}): Promise<Array<string>>;
