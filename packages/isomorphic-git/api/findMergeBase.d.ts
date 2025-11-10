/**
 * Find the merge base for a set of commits
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string[]} args.oids - Which commits
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 */
export function findMergeBase({ fs, dir, gitdir, oids, cache, }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    oids: string[];
    cache?: object;
}): Promise<any[]>;
import { FileSystem } from '../models/FileSystem.js';
