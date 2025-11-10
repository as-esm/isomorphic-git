/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {string} args.gitdir
 * @param {TagObject} args.tag
 *
 * @returns {Promise<string>}
 */
export function _writeTag({ fs, gitdir, tag }: {
    fs: import("../models/FileSystem.js").FileSystem;
    gitdir: string;
    tag: TagObject;
}): Promise<string>;
