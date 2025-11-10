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
export declare function _removeNote({ fs, cache, onSign, gitdir, ref, oid, author, committer, signingKey, }: {
    fs: any;
    cache: any;
    onSign: any;
    gitdir: any;
    ref?: string | undefined;
    oid: any;
    author: any;
    committer: any;
    signingKey: any;
}): Promise<any>;
