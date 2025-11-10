/**
 * Initialize a new repository
 *
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {string} [args.dir]
 * @param {string} [args.gitdir]
 * @param {boolean} [args.bare = false]
 * @param {string} [args.defaultBranch = 'master']
 * @returns {Promise<void>}
 */
export function _init({ fs, bare, dir, gitdir, defaultBranch, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    bare?: boolean | undefined;
    defaultBranch?: string | undefined;
}): Promise<void>;
