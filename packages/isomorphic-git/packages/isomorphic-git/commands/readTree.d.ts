/**
 *
 * @typedef {Object} ReadTreeResult - The object returned has the following schema:
 * @property {string} oid - SHA-1 object id of this tree
 * @property {TreeObject} tree - the parsed tree object
 */
/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string} args.oid
 * @param {string} [args.filepath]
 *
 * @returns {Promise<ReadTreeResult>}
 */
export function _readTree({ fs, cache, gitdir, oid, filepath, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    gitdir: string;
    oid: string;
    filepath?: string | undefined;
}): Promise<ReadTreeResult>;
/**
 * - The object returned has the following schema:
 */
export type ReadTreeResult = {
    /**
     * - SHA-1 object id of this tree
     */
    oid: string;
    /**
     * - the parsed tree object
     */
    tree: TreeObject;
};
