/**
 *
 * @typedef {Object} ReadTagResult - The object returned has the following schema:
 * @property {string} oid - SHA-1 object id of this tag
 * @property {TagObject} tag - the parsed tag object
 * @property {string} payload - PGP signing payload
 */
/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string} args.oid
 *
 * @returns {Promise<ReadTagResult>}
 */
export function _readTag({ fs, cache, gitdir, oid }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    gitdir: string;
    oid: string;
}): Promise<ReadTagResult>;
/**
 * - The object returned has the following schema:
 */
export type ReadTagResult = {
    /**
     * - SHA-1 object id of this tag
     */
    oid: string;
    /**
     * - the parsed tag object
     */
    tag: TagObject;
    /**
     * - PGP signing payload
     */
    payload: string;
};
