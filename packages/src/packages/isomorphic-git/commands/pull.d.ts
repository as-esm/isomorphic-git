/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {object} args.cache
 * @param {HttpClient} args.http
 * @param {ProgressCallback} [args.onProgress]
 * @param {MessageCallback} [args.onMessage]
 * @param {AuthCallback} [args.onAuth]
 * @param {AuthFailureCallback} [args.onAuthFailure]
 * @param {AuthSuccessCallback} [args.onAuthSuccess]
 * @param {string} args.dir
 * @param {string} args.gitdir
 * @param {string} args.ref
 * @param {string} [args.url]
 * @param {string} [args.remote]
 * @param {string} [args.remoteRef]
 * @param {boolean} [args.prune]
 * @param {boolean} [args.pruneTags]
 * @param {string} [args.corsProxy]
 * @param {boolean} args.singleBranch
 * @param {boolean} args.fastForward
 * @param {boolean} args.fastForwardOnly
 * @param {Object<string, string>} [args.headers]
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
 * @returns {Promise<void>} Resolves successfully when pull operation completes
 *
 */
export declare function _pull({ fs, cache, http, onProgress, onMessage, onAuth, onAuthSuccess, onAuthFailure, dir, gitdir, ref, url, remote, remoteRef, prune, pruneTags, fastForward, fastForwardOnly, corsProxy, singleBranch, headers, author, committer, signingKey, }: {
    fs: any;
    cache: any;
    http: any;
    onProgress: any;
    onMessage: any;
    onAuth: any;
    onAuthSuccess: any;
    onAuthFailure: any;
    dir: any;
    gitdir: any;
    ref: any;
    url: any;
    remote: any;
    remoteRef: any;
    prune: any;
    pruneTags: any;
    fastForward: any;
    fastForwardOnly: any;
    corsProxy: any;
    singleBranch: any;
    headers: any;
    author: any;
    committer: any;
    signingKey: any;
}): Promise<void>;
