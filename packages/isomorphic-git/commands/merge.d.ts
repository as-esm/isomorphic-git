import '../typedefs.ts';
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
export declare function _merge({ fs, cache, dir, gitdir, ours, theirs, fastForward, fastForwardOnly, dryRun, noUpdateBranch, abortOnConflict, message, author, committer, signingKey, onSign, mergeDriver, allowUnrelatedHistories, }: {
    fs: any;
    cache: any;
    dir: any;
    gitdir: any;
    ours: any;
    theirs: any;
    fastForward?: boolean | undefined;
    fastForwardOnly?: boolean | undefined;
    dryRun?: boolean | undefined;
    noUpdateBranch?: boolean | undefined;
    abortOnConflict?: boolean | undefined;
    message: any;
    author: any;
    committer: any;
    signingKey: any;
    onSign: any;
    mergeDriver: any;
    allowUnrelatedHistories?: boolean | undefined;
}): Promise<{
    oid: string;
    alreadyMerged: boolean;
    fastForward?: undefined;
    tree?: undefined;
    mergeCommit?: undefined;
} | {
    oid: string;
    fastForward: boolean;
    alreadyMerged?: undefined;
    tree?: undefined;
    mergeCommit?: undefined;
} | {
    oid: any;
    tree: any;
    mergeCommit: boolean;
    alreadyMerged?: undefined;
    fastForward?: undefined;
}>;
