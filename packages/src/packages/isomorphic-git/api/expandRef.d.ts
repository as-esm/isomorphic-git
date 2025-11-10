/**
 * Expand an abbreviated ref to its full name
 *
 * @param {Object} args
 * @param {FileSystem} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - The ref to expand (like "v1.0.0")
 *
 * @returns {Promise<string>} Resolves successfully with a full ref name ("refs/tags/v1.0.0")
 *
 * @example
 * let fullRef = await git.expandRef({ fs, dir: '/tutorial', ref: 'main'})
 * console.log(fullRef)
 *
 */
export function expandRef({ fs, dir, gitdir, ref }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    ref: string;
}): Promise<string>;
import { FileSystem } from '../models/FileSystem.js';
