/**
 *
 * @typedef {Object} PackObjectsResult The packObjects command returns an object with two properties:
 * @property {string} filename - The suggested filename for the packfile if you want to save it to disk somewhere. It includes the packfile SHA.
 * @property {Uint8Array} [packfile] - The packfile contents. Not present if `write` parameter was true, in which case the packfile was written straight to disk.
 */
/**
 * Create a packfile from an array of SHA-1 object ids
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string[]} args.oids - An array of SHA-1 object ids to be included in the packfile
 * @param {boolean} [args.write = false] - Whether to save the packfile to disk or not
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<PackObjectsResult>} Resolves successfully when the packfile is ready with the filename and buffer
 * @see PackObjectsResult
 *
 * @example
 * // Create a packfile containing only an empty tree
 * let { packfile } = await git.packObjects({
 *   fs,
 *   dir: '/tutorial',
 *   oids: ['4b825dc642cb6eb9a060e54bf8d69288fbee4904']
 * })
 * console.log(packfile)
 *
 */
export function packObjects({ fs, dir, gitdir, oids, write, cache, }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    oids: string[];
    write?: boolean | undefined;
    cache?: object;
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
import { FileSystem } from '../models/FileSystem.js';
