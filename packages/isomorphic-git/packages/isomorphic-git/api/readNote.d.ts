/**
 * Read the contents of a note
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.ref] - The notes ref to look under
 * @param {string} args.oid - The SHA-1 object id of the object to get the note for.
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<Uint8Array>} Resolves successfully with note contents as a Buffer.
 */
export function readNote({ fs, dir, gitdir, ref, oid, cache, }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    ref?: string | undefined;
    oid: string;
    cache?: object;
}): Promise<Uint8Array>;
import { FileSystem } from '../models/FileSystem.js';
