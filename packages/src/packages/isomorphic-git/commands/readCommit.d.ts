/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string} args.oid
 *
 * @returns {Promise<ReadCommitResult>} Resolves successfully with a git commit object
 * @see ReadCommitResult
 * @see CommitObject
 *
 */
export function _readCommit({ fs, cache, gitdir, oid }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    gitdir: string;
    oid: string;
}): Promise<ReadCommitResult>;
