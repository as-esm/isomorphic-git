/**
 * @param {Object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {string} args.gitdir
 * @param {boolean} [args.fullname = false] - Return the full path (e.g. "refs/heads/main") instead of the abbreviated form.
 * @param {boolean} [args.test = false] - If the current branch doesn't actually exist (such as right after git init) then return `undefined`.
 *
 * @returns {Promise<string|void>} The name of the current branch or undefined if the HEAD is detached.
 *
 */
export function _currentBranch({ fs, gitdir, fullname, test, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    gitdir: string;
    fullname?: boolean | undefined;
    test?: boolean | undefined;
}): Promise<string | void>;
