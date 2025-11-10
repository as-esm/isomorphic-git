/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {object} args.cache
 * @param {string} [args.dir]
 * @param {string} [args.gitdir=join(dir,'.git')]
 * @param {Walker[]} args.trees
 * @param {WalkerMap} [args.map]
 * @param {WalkerReduce} [args.reduce]
 * @param {WalkerIterate} [args.iterate]
 *
 * @returns {Promise<any>} The finished tree-walking result
 *
 * @see {WalkerMap}
 *
 */
export function _walk({ fs, cache, dir, gitdir, trees, map, reduce, iterate, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: object;
    dir?: string | undefined;
    gitdir?: string | undefined;
    trees: Walker[];
    map?: any;
    reduce?: any;
    iterate?: any;
}): Promise<any>;
