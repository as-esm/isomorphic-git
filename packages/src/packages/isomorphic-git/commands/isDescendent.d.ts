/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string} args.oid
 * @param {string} args.ancestor
 * @param {number} args.depth - Maximum depth to search before giving up. -1 means no maximum depth.
 *
 * @returns {Promise<boolean>}
 */
export function _isDescendent({ fs, cache, gitdir, oid, ancestor, depth, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    gitdir: string;
    oid: string;
    ancestor: string;
    depth: number;
}): Promise<boolean>;
