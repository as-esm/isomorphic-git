export class GitShallowManager {
    /**
     * Reads the `shallow` file in the Git repository and returns a set of object IDs (OIDs).
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
     * @returns {Promise<Set<string>>} - A set of shallow object IDs.
     */
    static read({ fs, gitdir }: {
        fs: FSClient;
        gitdir?: string | undefined;
    }): Promise<Set<string>>;
    /**
     * Writes a set of object IDs (OIDs) to the `shallow` file in the Git repository.
     * If the set is empty, the `shallow` file is removed.
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
     * @param {Set<string>} args.oids - A set of shallow object IDs to write.
     * @returns {Promise<void>}
     */
    static write({ fs, gitdir, oids }: {
        fs: FSClient;
        gitdir?: string | undefined;
        oids: Set<string>;
    }): Promise<void>;
}
