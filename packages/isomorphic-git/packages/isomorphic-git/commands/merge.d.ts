/**
 *
 * @typedef {Object} MergeResult - Returns an object with a schema like this:
 * @property {string} [oid] - The SHA-1 object id that is now at the head of the branch. Absent only if `dryRun` was specified and `mergeCommit` is true.
 * @property {boolean} [alreadyMerged] - True if the branch was already merged so no changes were made
 * @property {boolean} [fastForward] - True if it was a fast-forward merge
 * @property {boolean} [mergeCommit] - True if merge resulted in a merge commit
 * @property {string} [tree] - The SHA-1 object id of the tree resulting from a merge commit
 *
 */
/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {object} args.cache
 * @param {string} args.gitdir
 * @param {string} [args.ours]
 * @param {string} args.theirs
 * @param {boolean} args.fastForward
 * @param {boolean} args.fastForwardOnly
 * @param {boolean} args.dryRun
 * @param {boolean} args.noUpdateBranch
 * @param {boolean} args.abortOnConflict
 * @param {string} [args.message]
 * @param {Object} args.author
 * @param {string} args.author.name
 * @param {string} args.author.email
 * @param {number} args.author.timestamp
 * @param {number} args.author.timezoneOffset
 * @param {Object} args.committer
 * @param {string} args.committer.name
 * @param {string} args.committer.email
 * @param {number} args.committer.timestamp
 * @param {number} args.committer.timezoneOffset
 * @param {string} [args.signingKey]
 * @param {SignCallback} [args.onSign] - a PGP signing implementation
 * @param {MergeDriverCallback} [args.mergeDriver]
 * @param {boolean} args.allowUnrelatedHistories
 *
 * @returns {Promise<MergeResult>} Resolves to a description of the merge operation
 *
 */
export function _merge({ fs, cache, dir, gitdir, ours, theirs, fastForward, fastForwardOnly, dryRun, noUpdateBranch, abortOnConflict, message, author, committer, signingKey, onSign, mergeDriver, allowUnrelatedHistories, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: object;
    gitdir: string;
    ours?: string | undefined;
    theirs: string;
    fastForward: boolean;
    fastForwardOnly: boolean;
    dryRun: boolean;
    noUpdateBranch: boolean;
    abortOnConflict: boolean;
    message?: string | undefined;
    author: {
        name: string;
        email: string;
        timestamp: number;
        timezoneOffset: number;
    };
    committer: {
        name: string;
        email: string;
        timestamp: number;
        timezoneOffset: number;
    };
    signingKey?: string | undefined;
    onSign?: any;
    mergeDriver?: any;
    allowUnrelatedHistories: boolean;
}): Promise<MergeResult>;
/**
 * - Returns an object with a schema like this:
 */
export type MergeResult = {
    /**
     * - The SHA-1 object id that is now at the head of the branch. Absent only if `dryRun` was specified and `mergeCommit` is true.
     */
    oid?: string | undefined;
    /**
     * - True if the branch was already merged so no changes were made
     */
    alreadyMerged?: boolean | undefined;
    /**
     * - True if it was a fast-forward merge
     */
    fastForward?: boolean | undefined;
    /**
     * - True if merge resulted in a merge commit
     */
    mergeCommit?: boolean | undefined;
    /**
     * - The SHA-1 object id of the tree resulting from a merge commit
     */
    tree?: string | undefined;
};
