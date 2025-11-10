/**
 * Return committer object by using properties with this priority:
 * (1) provided committer object
 * -> (2) provided author object
 * -> (3) committer of provided commit object
 * -> (4) Config and current date/time
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.gitdir] - The [git directory](dir-vs-gitdir.md) path
 * @param {Object} [args.author] - The author object.
 * @param {Object} [args.committer] - The committer object.
 * @param {CommitObject} [args.commit] - A commit object.
 *
 * @returns {Promise<void | {name: string, email: string, timestamp: number, timezoneOffset: number }>}
 */
export function normalizeCommitterObject({ fs, gitdir, author, committer, commit, }: {
    fs: FsClient;
    gitdir?: string | undefined;
    author?: any;
    committer?: any;
    commit?: any;
}): Promise<void | {
    name: string;
    email: string;
    timestamp: number;
    timezoneOffset: number;
}>;
