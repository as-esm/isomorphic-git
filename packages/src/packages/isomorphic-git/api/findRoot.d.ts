/**
 * Find the root git directory
 *
 * Starting at `filepath`, walks upward until it finds a directory that contains a subdirectory called '.git'.
 *
 * @param {Object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {string} args.filepath - The file directory to start searching in.
 *
 * @returns {Promise<string>} Resolves successfully with a root git directory path
 * @throws {NotFoundError}
 *
 * @example
 * let gitroot = await git.findRoot({
 *   fs,
 *   filepath: '/tutorial/src/utils'
 * })
 * console.log(gitroot)
 *
 */
export function findRoot({ fs, filepath }: {
    fs: FileSystem;
    filepath: string;
}): Promise<string>;
import { FileSystem } from '../models/FileSystem.js';
