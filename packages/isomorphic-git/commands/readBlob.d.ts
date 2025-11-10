/**
 *
 * @typedef {Object} ReadBlobResult - The object returned has the following schema:
 * @property {string} oid
 * @property {Uint8Array} blob
 *
 */
/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string} args.oid
 * @param {string} [args.filepath]
 *
 * @returns {Promise<ReadBlobResult>} Resolves successfully with a blob object description
 * @see ReadBlobResult
 */
export function _readBlob({ fs, cache, gitdir, oid, filepath, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    gitdir: string;
    oid: string;
    filepath?: string | undefined;
}): Promise<ReadBlobResult>;
/**
 * - The object returned has the following schema:
 */
export type ReadBlobResult = {
    oid: string;
    blob: Uint8Array;
};
