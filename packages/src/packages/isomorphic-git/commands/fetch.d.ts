/**
 *
 * @typedef {object} FetchResult - The object returned has the following schema:
 * @property {string | null} defaultBranch - The branch that is cloned if no branch is specified
 * @property {string | null} fetchHead - The SHA-1 object id of the fetched head commit
 * @property {string | null} fetchHeadDescription - a textual description of the branch that was fetched
 * @property {Object<string, string>} [headers] - The HTTP response headers returned by the git server
 * @property {string[]} [pruned] - A list of branches that were pruned, if you provided the `prune` parameter
 *
 */
/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {HttpClient} args.http
 * @param {ProgressCallback} [args.onProgress]
 * @param {MessageCallback} [args.onMessage]
 * @param {AuthCallback} [args.onAuth]
 * @param {AuthFailureCallback} [args.onAuthFailure]
 * @param {AuthSuccessCallback} [args.onAuthSuccess]
 * @param {string} args.gitdir
 * @param {string|void} [args.url]
 * @param {string} [args.corsProxy]
 * @param {string} [args.ref]
 * @param {string} [args.remoteRef]
 * @param {string} [args.remote]
 * @param {boolean} [args.singleBranch = false]
 * @param {boolean} [args.tags = false]
 * @param {number} [args.depth]
 * @param {Date} [args.since]
 * @param {string[]} [args.exclude = []]
 * @param {boolean} [args.relative = false]
 * @param {Object<string, string>} [args.headers]
 * @param {boolean} [args.prune]
 * @param {boolean} [args.pruneTags]
 *
 * @returns {Promise<FetchResult>}
 * @see FetchResult
 */
export function _fetch({ fs, cache, http, onProgress, onMessage, onAuth, onAuthSuccess, onAuthFailure, gitdir, ref: _ref, remoteRef: _remoteRef, remote: _remote, url: _url, corsProxy, depth, since, exclude, relative, tags, singleBranch, headers, prune, pruneTags, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    http: HttpClient;
    onProgress?: any;
    onMessage?: any;
    onAuth?: any;
    onAuthFailure?: any;
    onAuthSuccess?: any;
    gitdir: string;
    url?: string | void | undefined;
    corsProxy?: string | undefined;
    ref?: string | undefined;
    remoteRef?: string | undefined;
    remote?: string | undefined;
    singleBranch?: boolean | undefined;
    tags?: boolean | undefined;
    depth?: number | undefined;
    since?: Date | undefined;
    exclude?: string[] | undefined;
    relative?: boolean | undefined;
    headers?: {
        [x: string]: string;
    } | undefined;
    prune?: boolean | undefined;
    pruneTags?: boolean | undefined;
}): Promise<FetchResult>;
/**
 * - The object returned has the following schema:
 */
export type FetchResult = {
    /**
     * - The branch that is cloned if no branch is specified
     */
    defaultBranch: string | null;
    /**
     * - The SHA-1 object id of the fetched head commit
     */
    fetchHead: string | null;
    /**
     * - a textual description of the branch that was fetched
     */
    fetchHeadDescription: string | null;
    /**
     * - The HTTP response headers returned by the git server
     */
    headers?: {
        [x: string]: string;
    } | undefined;
    /**
     * - A list of branches that were pruned, if you provided the `prune` parameter
     */
    pruned?: string[] | undefined;
};
