/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {string} args.gitdir
 * @param {CommitObject} args.commit
 *
 * @returns {Promise<string>}
 * @see CommitObject
 *
 */
export function _writeCommit({ fs, gitdir, commit }: {
    fs: import("../models/FileSystem.js").FileSystem;
    gitdir: string;
    commit: CommitObject;
}): Promise<string>;
