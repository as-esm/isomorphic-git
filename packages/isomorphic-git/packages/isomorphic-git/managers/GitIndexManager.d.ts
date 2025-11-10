export class GitIndexManager {
    /**
     * Manages access to the Git index file, ensuring thread-safe operations and caching.
     *
     * @param {object} opts - Options for acquiring the Git index.
     * @param {FSClient} opts.fs - A file system implementation.
     * @param {string} opts.gitdir - The path to the `.git` directory.
     * @param {object} opts.cache - A shared cache object for storing index data.
     * @param {boolean} [opts.allowUnmerged=true] - Whether to allow unmerged paths in the index.
     * @param {function(GitIndex): any} closure - A function to execute with the Git index.
     * @returns {Promise<any>} The result of the closure function.
     * @throws {UnmergedPathsError} If unmerged paths exist and `allowUnmerged` is `false`.
     */
    static acquire({ fs, gitdir, cache, allowUnmerged }: {
        fs: FSClient;
        gitdir: string;
        cache: object;
        allowUnmerged?: boolean | undefined;
    }, closure: (arg0: GitIndex) => any): Promise<any>;
}
import { GitIndex } from '../models/GitIndex.js';
