/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {string} [args.dir]
 * @param {string} args.gitdir
 * @param {Iterable<string>} args.start
 * @param {Iterable<string>} args.finish
 * @returns {Promise<Set<string>>}
 */
export function listCommitsAndTags({ fs, cache, dir, gitdir, start, finish, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    dir?: string | undefined;
    gitdir: string;
    start: Iterable<string>;
    finish: Iterable<string>;
}): Promise<Set<string>>;
