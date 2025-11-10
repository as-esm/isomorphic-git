/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {ProgressCallback} [args.onProgress]
 * @param {string} args.dir
 * @param {string} args.gitdir
 * @param {string} args.filepath
 *
 * @returns {Promise<{oids: string[]}>}
 */
export function _indexPack({ fs, cache, onProgress, dir, gitdir, filepath, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    onProgress?: any;
    dir: string;
    gitdir: string;
    filepath: string;
}): Promise<{
    oids: string[];
}>;
