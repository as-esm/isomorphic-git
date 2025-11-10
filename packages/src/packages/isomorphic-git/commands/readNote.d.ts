/**
 * Read the contents of a note
 *
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string} [args.ref] - The notes ref to look under
 * @param {string} args.oid
 *
 * @returns {Promise<Uint8Array>} Resolves successfully with note contents as a Buffer.
 */
export function _readNote({ fs, cache, gitdir, ref, oid, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    gitdir: string;
    ref?: string | undefined;
    oid: string;
}): Promise<Uint8Array>;
