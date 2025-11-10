/**
 * Rename a branch
 *
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {string} args.gitdir
 * @param {string} args.ref - The name of the new branch
 * @param {string} args.oldref - The name of the old branch
 * @param {boolean} [args.checkout = false]
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 */
export function _renameBranch({ fs, gitdir, oldref, ref, checkout, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    gitdir: string;
    ref: string;
    oldref: string;
    checkout?: boolean | undefined;
}): Promise<void>;
