/**
 *
 * @typedef {Object} ReadBlobResult - The object returned has the following schema:
 * @property {string} oid
 * @property {Uint8Array} blob
 *
 */
/**
 * Read a blob object directly
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.oid - The SHA-1 object id to get. Annotated tags, commits, and trees are peeled.
 * @param {string} [args.filepath] - Don't return the object with `oid` itself, but resolve `oid` to a tree and then return the blob object at that filepath.
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<ReadBlobResult>} Resolves successfully with a blob object description
 * @see ReadBlobResult
 *
 * @example
 * // Get the contents of 'README.md' in the main branch.
 * let commitOid = await git.resolveRef({ fs, dir: '/tutorial', ref: 'main' })
 * console.log(commitOid)
 * let { blob } = await git.readBlob({
 *   fs,
 *   dir: '/tutorial',
 *   oid: commitOid,
 *   filepath: 'README.md'
 * })
 * console.log(Buffer.from(blob).toString('utf8'))
 *
 */
export function readBlob({ fs, dir, gitdir, oid, filepath, cache, }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    oid: string;
    filepath?: string | undefined;
    cache?: object;
}): Promise<ReadBlobResult>;
/**
 * - The object returned has the following schema:
 */
export type ReadBlobResult = {
    oid: string;
    blob: Uint8Array;
};
import { FileSystem } from '../models/FileSystem.js';
