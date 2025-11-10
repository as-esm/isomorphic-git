/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string} args.oid
 * @param {string} [args.format]
 */
export function _readObject({ fs, cache, gitdir, oid, format, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    gitdir: string;
    oid: string;
    format?: string | undefined;
}): Promise<any>;
