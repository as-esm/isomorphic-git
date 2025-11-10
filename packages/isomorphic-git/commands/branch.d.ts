/**
 * Create a branch
 *
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {string} args.gitdir
 * @param {string} args.ref
 * @param {string} [args.object = 'HEAD']
 * @param {boolean} [args.checkout = false]
 * @param {boolean} [args.force = false]
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.branch({ dir: '$input((/))', ref: '$input((develop))' })
 * console.log('done')
 *
 */
export function _branch({ fs, gitdir, ref, object, checkout, force, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    gitdir: string;
    ref: string;
    object?: string | undefined;
    checkout?: boolean | undefined;
    force?: boolean | undefined;
}): Promise<void>;
