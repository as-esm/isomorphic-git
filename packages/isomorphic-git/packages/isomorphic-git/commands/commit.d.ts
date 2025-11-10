/**
 *
 * @param {Object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {object} args.cache
 * @param {SignCallback} [args.onSign]
 * @param {string} args.gitdir
 * @param {string} [args.message]
 * @param {Object} [args.author]
 * @param {string} [args.author.name]
 * @param {string} [args.author.email]
 * @param {number} [args.author.timestamp]
 * @param {number} [args.author.timezoneOffset]
 * @param {Object} [args.committer]
 * @param {string} [args.committer.name]
 * @param {string} [args.committer.email]
 * @param {number} [args.committer.timestamp]
 * @param {number} [args.committer.timezoneOffset]
 * @param {string} [args.signingKey]
 * @param {boolean} [args.amend = false]
 * @param {boolean} [args.dryRun = false]
 * @param {boolean} [args.noUpdateBranch = false]
 * @param {string} [args.ref]
 * @param {string[]} [args.parent]
 * @param {string} [args.tree]
 *
 * @returns {Promise<string>} Resolves successfully with the SHA-1 object id of the newly created commit.
 */
export function _commit({ fs, cache, onSign, gitdir, message, author: _author, committer: _committer, signingKey, amend, dryRun, noUpdateBranch, ref, parent, tree, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: object;
    onSign?: any;
    gitdir: string;
    message?: string | undefined;
    author?: {
        name?: string | undefined;
        email?: string | undefined;
        timestamp?: number | undefined;
        timezoneOffset?: number | undefined;
    } | undefined;
    committer?: {
        name?: string | undefined;
        email?: string | undefined;
        timestamp?: number | undefined;
        timezoneOffset?: number | undefined;
    } | undefined;
    signingKey?: string | undefined;
    amend?: boolean | undefined;
    dryRun?: boolean | undefined;
    noUpdateBranch?: boolean | undefined;
    ref?: string | undefined;
    parent?: string[] | undefined;
    tree?: string | undefined;
}): Promise<string>;
