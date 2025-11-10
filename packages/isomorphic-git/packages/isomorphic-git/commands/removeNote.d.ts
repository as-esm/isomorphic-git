/**
 * @param {object} args
 * @param {FileSystem} args.fs
 * @param {object} args.cache
 * @param {SignCallback} [args.onSign]
 * @param {string} [args.dir]
 * @param {string} [args.gitdir=join(dir,'.git')]
 * @param {string} [args.ref]
 * @param {string} args.oid
 * @param {Object} args.author
 * @param {string} args.author.name
 * @param {string} args.author.email
 * @param {number} args.author.timestamp
 * @param {number} args.author.timezoneOffset
 * @param {Object} args.committer
 * @param {string} args.committer.name
 * @param {string} args.committer.email
 * @param {number} args.committer.timestamp
 * @param {number} args.committer.timezoneOffset
 * @param {string} [args.signingKey]
 *
 * @returns {Promise<string>}
 */
export function _removeNote({ fs, cache, onSign, gitdir, ref, oid, author, committer, signingKey, }: {
    fs: FileSystem;
    cache: object;
    onSign?: any;
    dir?: string | undefined;
    gitdir?: string | undefined;
    ref?: string | undefined;
    oid: string;
    author: {
        name: string;
        email: string;
        timestamp: number;
        timezoneOffset: number;
    };
    committer: {
        name: string;
        email: string;
        timestamp: number;
        timezoneOffset: number;
    };
    signingKey?: string | undefined;
}): Promise<string>;
