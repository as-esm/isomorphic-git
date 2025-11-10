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
 * @param {PrePushCallback} [args.onPrePush]
 * @param {string} args.gitdir
 * @param {string} [args.ref]
 * @param {string} [args.remoteRef]
 * @param {string} [args.remote]
 * @param {boolean} [args.force = false]
 * @param {boolean} [args.delete = false]
 * @param {string} [args.url]
 * @param {string} [args.corsProxy]
 * @param {Object<string, string>} [args.headers]
 *
 * @returns {Promise<PushResult>}
 */
export function _push({ fs, cache, http, onProgress, onMessage, onAuth, onAuthSuccess, onAuthFailure, onPrePush, gitdir, ref: _ref, remoteRef: _remoteRef, remote, url: _url, force, delete: _delete, corsProxy, headers, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    http: HttpClient;
    onProgress?: any;
    onMessage?: any;
    onAuth?: any;
    onAuthFailure?: any;
    onAuthSuccess?: any;
    onPrePush?: any;
    gitdir: string;
    ref?: string | undefined;
    remoteRef?: string | undefined;
    remote?: string | undefined;
    force?: boolean | undefined;
    delete?: boolean | undefined;
    url?: string | undefined;
    corsProxy?: string | undefined;
    headers?: {
        [x: string]: string;
    } | undefined;
}): Promise<PushResult>;
