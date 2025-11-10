/**
 * List all the object notes
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.ref] - The notes ref to look under
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<Array<{target: string, note: string}>>} Resolves successfully with an array of entries containing SHA-1 object ids of the note and the object the note targets
 */
export function listNotes({ fs, dir, gitdir, ref, cache, }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    ref?: string | undefined;
    cache?: object;
}): Promise<Array<{
    target: string;
    note: string;
}>>;
import { FileSystem } from '../models/FileSystem.js';
