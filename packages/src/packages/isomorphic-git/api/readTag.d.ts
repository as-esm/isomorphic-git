/**
 *
 * @typedef {Object} ReadTagResult - The object returned has the following schema:
 * @property {string} oid - SHA-1 object id of this tag
 * @property {TagObject} tag - the parsed tag object
 * @property {string} payload - PGP signing payload
 */
/**
 * Read an annotated tag object directly
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.oid - The SHA-1 object id to get
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<ReadTagResult>} Resolves successfully with a git object description
 * @see ReadTagResult
 * @see TagObject
 *
 */
export function readTag({ fs, dir, gitdir, oid, cache, }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    oid: string;
    cache?: object;
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
import { FileSystem } from '../models/FileSystem.js';
