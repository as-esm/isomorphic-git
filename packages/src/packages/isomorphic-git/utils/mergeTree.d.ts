/**
 * Create a merged tree
 *
 * @param {Object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {object} args.cache
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ourOid - The SHA-1 object id of our tree
 * @param {string} args.baseOid - The SHA-1 object id of the base tree
 * @param {string} args.theirOid - The SHA-1 object id of their tree
 * @param {string} [args.ourName='ours'] - The name to use in conflicted files for our hunks
 * @param {string} [args.baseName='base'] - The name to use in conflicted files (in diff3 format) for the base hunks
 * @param {string} [args.theirName='theirs'] - The name to use in conflicted files for their hunks
 * @param {boolean} [args.dryRun=false]
 * @param {boolean} [args.abortOnConflict=false]
 * @param {MergeDriverCallback} [args.mergeDriver]
 *
 * @returns {Promise<string>} - The SHA-1 object id of the merged tree
 *
 */
export function mergeTree({ fs, cache, dir, gitdir, index, ourOid, baseOid, theirOid, ourName, baseName, theirName, dryRun, abortOnConflict, mergeDriver, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: object;
    dir?: string | undefined;
    gitdir?: string | undefined;
    ourOid: string;
    baseOid: string;
    theirOid: string;
    ourName?: string | undefined;
    baseName?: string | undefined;
    theirName?: string | undefined;
    dryRun?: boolean | undefined;
    abortOnConflict?: boolean | undefined;
    mergeDriver?: any;
}): Promise<string>;
