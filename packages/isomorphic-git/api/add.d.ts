/**
 * Add a file to the git index (aka staging area)
 *
 * @param {object} args
 * @param {import('../typedefs.js').FsClient} args.fs - a file system implementation
 * @param {string} args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string|string[]} args.filepath - The path to the file to add to the index
 * @param {object} [args.cache] - a [cache](cache.md) object
 * @param {boolean} [args.force=false] - add to index even if matches gitignore. Think `git add --force`
 * @param {boolean} [args.parallel=false] - process each input file in parallel. Parallel processing will result in more memory consumption but less process time
 *
 * @returns {Promise<void>} Resolves successfully once the git index has been updated
 *
 * @example
 * await fs.promises.writeFile('/tutorial/README.md', `# TEST`)
 * await git.add({ fs, dir: '/tutorial', filepath: 'README.md' })
 * console.log('done')
 *
 */
export function add({ fs: _fs, dir, gitdir, filepath, cache, force, parallel, }: {
    fs: import("../typedefs.js").FsClient;
    dir: string;
    gitdir?: string | undefined;
    filepath: string | string[];
    cache?: object;
    force?: boolean | undefined;
    parallel?: boolean | undefined;
}): Promise<void>;
