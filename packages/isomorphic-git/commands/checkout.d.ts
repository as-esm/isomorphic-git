/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {ProgressCallback} [args.onProgress]
 * @param {PostCheckoutCallback} [args.onPostCheckout]
 * @param {string} args.dir
 * @param {string} args.gitdir
 * @param {string} args.ref
 * @param {string[]} [args.filepaths]
 * @param {string} args.remote
 * @param {boolean} args.noCheckout
 * @param {boolean} [args.noUpdateHead]
 * @param {boolean} [args.dryRun]
 * @param {boolean} [args.force]
 * @param {boolean} [args.track]
 * @param {boolean} [args.nonBlocking]
 * @param {number} [args.batchSize]
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 */
export function _checkout({ fs, cache, onProgress, onPostCheckout, dir, gitdir, remote, ref, filepaths, noCheckout, noUpdateHead, dryRun, force, track, nonBlocking, batchSize, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    onProgress?: any;
    onPostCheckout?: any;
    dir: string;
    gitdir: string;
    ref: string;
    filepaths?: string[] | undefined;
    remote: string;
    noCheckout: boolean;
    noUpdateHead?: boolean | undefined;
    dryRun?: boolean | undefined;
    force?: boolean | undefined;
    track?: boolean | undefined;
    nonBlocking?: boolean | undefined;
    batchSize?: number | undefined;
}): Promise<void>;
