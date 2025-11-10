export class GitIgnoreManager {
    /**
     * Determines whether a given file is ignored based on `.gitignore` rules and exclusion files.
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} args.dir - The working directory.
     * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
     * @param {string} args.filepath - The path of the file to check.
     * @returns {Promise<boolean>} - `true` if the file is ignored, `false` otherwise.
     */
    static isIgnored({ fs, dir, gitdir, filepath }: {
        fs: FSClient;
        dir: string;
        gitdir?: string | undefined;
        filepath: string;
    }): Promise<boolean>;
}
