/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string[]} args.oids
 */
export function _pack({ fs, cache, dir, gitdir, oids, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    dir?: string | undefined;
    gitdir?: string | undefined;
    oids: string[];
}): Promise<any[]>;
