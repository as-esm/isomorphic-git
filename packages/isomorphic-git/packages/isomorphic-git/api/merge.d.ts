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
 * Merge two branches
 *
 * Currently it will fail if multiple candidate merge bases are found. (It doesn't yet implement the recursive merge strategy.)
 *
 * Currently it does not support selecting alternative merge strategies.
 *
 * Currently it is not possible to abort an incomplete merge. To restore the worktree to a clean state, you will need to checkout an earlier commit.
 *
 * Currently it does not directly support the behavior of `git merge --continue`. To complete a merge after manual conflict resolution, you will need to add and commit the files manually, and specify the appropriate parent commits.
 *
 * ## Manually resolving merge conflicts
 * By default, if isomorphic-git encounters a merge conflict it cannot resolve using the builtin diff3 algorithm or provided merge driver, it will abort and throw a `MergeNotSupportedError`.
 * This leaves the index and working tree untouched.
 *
 * When `abortOnConflict` is set to `false`, and a merge conflict cannot be automatically resolved, a `MergeConflictError` is thrown and the results of the incomplete merge will be written to the working directory.
 * This includes conflict markers in files with unresolved merge conflicts.
 *
 * To complete the merge, edit the conflicting files as you see fit, and then add and commit the resolved merge.
 *
 * For a proper merge commit, be sure to specify the branches or commits you are merging in the `parent` argument to `git.commit`.
 * For example, say we are merging the branch `feature` into the branch `main` and there is a conflict we want to resolve manually.
 * The flow would look like this:
 *
 * ```
 * await git.merge({
 *   fs,
 *   dir,
 *   ours: 'main',
 *   theirs: 'feature',
 *   abortOnConflict: false,
 * }).catch(e => {
 *   if (e instanceof Errors.MergeConflictError) {
 *     console.log(
 *       'Automatic merge failed for the following files: '
 *       + `${e.data}. `
 *       + 'Resolve these conflicts and then commit your changes.'
 *     )
 *   } else throw e
 * })
 *
 * // This is the where we manually edit the files that have been written to the working directory
 * // ...
 * // Files have been edited and we are ready to commit
 *
 * await git.add({
 *   fs,
 *   dir,
 *   filepath: '.',
 * })
 *
 * await git.commit({
 *   fs,
 *   dir,
 *   ref: 'main',
 *   message: "Merge branch 'feature' into main",
 *   parent: ['main', 'feature'], // Be sure to specify the parents when creating a merge commit
 * })
 * ```
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {SignCallback} [args.onSign] - a PGP signing implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.ours] - The branch receiving the merge. If undefined, defaults to the current branch.
 * @param {string} args.theirs - The branch to be merged
 * @param {boolean} [args.fastForward = true] - If false, create a merge commit in all cases.
 * @param {boolean} [args.fastForwardOnly = false] - If true, then non-fast-forward merges will throw an Error instead of performing a merge.
 * @param {boolean} [args.dryRun = false] - If true, simulates a merge so you can test whether it would succeed.
 * @param {boolean} [args.noUpdateBranch = false] - If true, does not update the branch pointer after creating the commit.
 * @param {boolean} [args.abortOnConflict = true] - If true, merges with conflicts will not update the worktree or index.
 * @param {string} [args.message] - Overrides the default auto-generated merge commit message
 * @param {Object} [args.author] - passed to [commit](commit.md) when creating a merge commit
 * @param {string} [args.author.name] - Default is `user.name` config.
 * @param {string} [args.author.email] - Default is `user.email` config.
 * @param {number} [args.author.timestamp=Math.floor(Date.now()/1000)] - Set the author timestamp field. This is the integer number of seconds since the Unix epoch (1970-01-01 00:00:00).
 * @param {number} [args.author.timezoneOffset] - Set the author timezone offset field. This is the difference, in minutes, from the current timezone to UTC. Default is `(new Date()).getTimezoneOffset()`.
 * @param {Object} [args.committer] - passed to [commit](commit.md) when creating a merge commit
 * @param {string} [args.committer.name] - Default is `user.name` config.
 * @param {string} [args.committer.email] - Default is `user.email` config.
 * @param {number} [args.committer.timestamp=Math.floor(Date.now()/1000)] - Set the committer timestamp field. This is the integer number of seconds since the Unix epoch (1970-01-01 00:00:00).
 * @param {number} [args.committer.timezoneOffset] - Set the committer timezone offset field. This is the difference, in minutes, from the current timezone to UTC. Default is `(new Date()).getTimezoneOffset()`.
 * @param {string} [args.signingKey] - passed to [commit](commit.md) when creating a merge commit
 * @param {object} [args.cache] - a [cache](cache.md) object
 * @param {MergeDriverCallback} [args.mergeDriver] - a [merge driver](mergeDriver.md) implementation
 * @param {boolean} [args.allowUnrelatedHistories = false] - If true, allows merging histories of two branches that started their lives independently.
 *
 * @returns {Promise<MergeResult>} Resolves to a description of the merge operation
 * @see MergeResult
 *
 * @example
 * let m = await git.merge({
 *   fs,
 *   dir: '/tutorial',
 *   ours: 'main',
 *   theirs: 'remotes/origin/main'
 * })
 * console.log(m)
 *
 */
export function merge({ fs: _fs, onSign, dir, gitdir, ours, theirs, fastForward, fastForwardOnly, dryRun, noUpdateBranch, abortOnConflict, message, author: _author, committer: _committer, signingKey, cache, mergeDriver, allowUnrelatedHistories, }: {
    fs: FileSystem;
    onSign?: any;
    dir?: string | undefined;
    gitdir?: string | undefined;
    ours?: string | undefined;
    theirs: string;
    fastForward?: boolean | undefined;
    fastForwardOnly?: boolean | undefined;
    dryRun?: boolean | undefined;
    noUpdateBranch?: boolean | undefined;
    abortOnConflict?: boolean | undefined;
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
    cache?: object;
    mergeDriver?: any;
    allowUnrelatedHistories?: boolean | undefined;
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
import { FileSystem } from '../models/FileSystem.js';
