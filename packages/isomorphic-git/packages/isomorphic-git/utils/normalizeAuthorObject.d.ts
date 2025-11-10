/**
 * Return author object by using properties following this priority:
 * (1) provided author object
 * -> (2) author of provided commit object
 * -> (3) Config and current date/time
 *
 * @param {Object} args
 * @param {FileSystem} args.fs - a file system implementation
 * @param {string} [args.gitdir] - The [git directory](dir-vs-gitdir.md) path
 * @param {Object} [args.author] - The author object.
 * @param {import('../typedefs.js').CommitObject} [args.commit] - A commit object.
 *
 * @returns {Promise<void | {name: string, email: string, timestamp: number, timezoneOffset: number }>}
 */
export function normalizeAuthorObject({ fs, gitdir, author, commit }: {
    fs: FileSystem;
    gitdir?: string | undefined;
    author?: any;
    commit?: import("../typedefs.js").CommitObject | undefined;
}): Promise<void | {
    name: string;
    email: string;
    timestamp: number;
    timezoneOffset: number;
}>;
