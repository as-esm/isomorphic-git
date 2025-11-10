/**
 * List all the object notes
 *
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string} args.ref
 *
 * @returns {Promise<Array<{target: string, note: string}>>}
 */
export function _listNotes({ fs, cache, gitdir, ref }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    gitdir: string;
    ref: string;
}): Promise<Array<{
    target: string;
    note: string;
}>>;
