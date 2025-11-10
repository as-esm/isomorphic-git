/**
 * Like `pull`, but hard-coded with `fastForward: true` so there is no need for an `author` parameter.
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {HttpClient} args.http - an HTTP client
 * @param {ProgressCallback} [args.onProgress] - optional progress event callback
 * @param {MessageCallback} [args.onMessage] - optional message event callback
 * @param {AuthCallback} [args.onAuth] - optional auth fill callback
 * @param {AuthFailureCallback} [args.onAuthFailure] - optional auth rejected callback
 * @param {AuthSuccessCallback} [args.onAuthSuccess] - optional auth approved callback
 * @param {string} args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.ref] - Which branch to merge into. By default this is the currently checked out branch.
 * @param {string} [args.url] - (Added in 1.1.0) The URL of the remote repository. The default is the value set in the git config for that remote.
 * @param {string} [args.remote] - (Added in 1.1.0) If URL is not specified, determines which remote to use.
 * @param {string} [args.remoteRef] - (Added in 1.1.0) The name of the branch on the remote to fetch. By default this is the configured remote tracking branch.
 * @param {string} [args.corsProxy] - Optional [CORS proxy](https://www.npmjs.com/%40isomorphic-git/cors-proxy). Overrides value in repo config.
 * @param {boolean} [args.singleBranch = false] - Instead of the default behavior of fetching all the branches, only fetch a single branch.
 * @param {Object<string, string>} [args.headers] - Additional headers to include in HTTP requests, similar to git's `extraHeader` config
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<void>} Resolves successfully when pull operation completes
 *
 * @example
 * await git.fastForward({
 *   fs,
 *   http,
 *   dir: '/tutorial',
 *   ref: 'main',
 *   singleBranch: true
 * })
 * console.log('done')
 *
 */
export function fastForward({ fs, http, onProgress, onMessage, onAuth, onAuthSuccess, onAuthFailure, dir, gitdir, ref, url, remote, remoteRef, corsProxy, singleBranch, headers, cache, }: {
    fs: FileSystem;
    http: HttpClient;
    onProgress?: any;
    onMessage?: any;
    onAuth?: any;
    onAuthFailure?: any;
    onAuthSuccess?: any;
    dir: string;
    gitdir?: string | undefined;
    ref?: string | undefined;
    url?: string | undefined;
    remote?: string | undefined;
    remoteRef?: string | undefined;
    corsProxy?: string | undefined;
    singleBranch?: boolean | undefined;
    headers?: {
        [x: string]: string;
    } | undefined;
    cache?: object;
}): Promise<void>;
import { FileSystem } from '../models/FileSystem.js';
