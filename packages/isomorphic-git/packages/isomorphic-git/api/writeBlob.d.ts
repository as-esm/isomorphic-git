/**
 * Write a blob object directly
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {Uint8Array} args.blob - The blob object to write
 *
 * @returns {Promise<string>} Resolves successfully with the SHA-1 object id of the newly written object
 *
 * @example
 * // Manually create a blob.
 * let oid = await git.writeBlob({
 *   fs,
 *   dir: '/tutorial',
 *   blob: new Uint8Array([])
 * })
 *
 * console.log('oid', oid) // should be 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'
 *
 */
export function writeBlob({ fs, dir, gitdir, blob }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    blob: Uint8Array;
}): Promise<string>;
import { FileSystem } from '../models/FileSystem.js';
