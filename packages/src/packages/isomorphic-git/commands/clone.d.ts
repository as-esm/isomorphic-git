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
 * @param {PostCheckoutCallback} [args.onPostCheckout]
 * @param {string} [args.dir]
 * @param {string} args.gitdir
 * @param {string} args.url
 * @param {string} args.corsProxy
 * @param {string} args.ref
 * @param {boolean} args.singleBranch
 * @param {boolean} args.noCheckout
 * @param {boolean} args.noTags
 * @param {string} args.remote
 * @param {number} args.depth
 * @param {Date} args.since
 * @param {string[]} args.exclude
 * @param {boolean} args.relative
 * @param {Object<string, string>} args.headers
 * @param {boolean} [args.nonBlocking]
 * @param {number} [args.batchSize]
 *
 * @returns {Promise<void>} Resolves successfully when clone completes
 *
 */
export function _clone({ fs, cache, http, onProgress, onMessage, onAuth, onAuthSuccess, onAuthFailure, onPostCheckout, dir, gitdir, url, corsProxy, ref, remote, depth, since, exclude, relative, singleBranch, noCheckout, noTags, headers, nonBlocking, batchSize, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: object;
    http: HttpClient;
    onProgress?: any;
    onMessage?: any;
    onAuth?: any;
    onAuthFailure?: any;
    onAuthSuccess?: any;
    onPostCheckout?: any;
    dir?: string | undefined;
    gitdir: string;
    url: string;
    corsProxy: string;
    ref: string;
    singleBranch: boolean;
    noCheckout: boolean;
    noTags: boolean;
    remote: string;
    depth: number;
    since: Date;
    exclude: string[];
    relative: boolean;
    headers: {
        [x: string]: string;
    };
    nonBlocking?: boolean | undefined;
    batchSize?: number | undefined;
}): Promise<void>;
