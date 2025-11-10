/**
 *
 * @typedef {Object} PackObjectsResult The packObjects command returns an object with two properties:
 * @property {string} filename - The suggested filename for the packfile if you want to save it to disk somewhere. It includes the packfile SHA.
 * @property {Uint8Array} [packfile] - The packfile contents. Not present if `write` parameter was true, in which case the packfile was written straight to disk.
 */
/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string[]} args.oids
 * @param {boolean} args.write
 *
 * @returns {Promise<PackObjectsResult>}
 * @see PackObjectsResult
 */
export function _packObjects({ fs, cache, gitdir, oids, write }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    gitdir: string;
    oids: string[];
    write: boolean;
}): Promise<PackObjectsResult>;
/**
 * The packObjects command returns an object with two properties:
 */
export type PackObjectsResult = {
    /**
     * - The suggested filename for the packfile if you want to save it to disk somewhere. It includes the packfile SHA.
     */
    filename: string;
    /**
     * - The packfile contents. Not present if `write` parameter was true, in which case the packfile was written straight to disk.
     */
    packfile?: Uint8Array<ArrayBufferLike> | undefined;
};
