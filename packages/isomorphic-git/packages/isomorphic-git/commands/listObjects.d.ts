/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {string} [args.dir]
 * @param {string} args.gitdir
 * @param {Iterable<string>} args.oids
 * @returns {Promise<Set<string>>}
 */
export function listObjects({ fs, cache, dir, gitdir, oids, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    dir?: string | undefined;
    gitdir: string;
    oids: Iterable<string>;
}): Promise<Set<string>>;
