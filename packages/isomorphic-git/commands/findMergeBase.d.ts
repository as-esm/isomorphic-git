/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string[]} args.oids
 *
 */
export function _findMergeBase({ fs, cache, gitdir, oids }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    gitdir: string;
    oids: string[];
}): Promise<any[]>;
