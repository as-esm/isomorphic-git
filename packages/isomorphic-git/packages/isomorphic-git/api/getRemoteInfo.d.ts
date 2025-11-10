/**
 *
 * @typedef {Object} GetRemoteInfoResult - The object returned has the following schema:
 * @property {string[]} capabilities - The list of capabilities returned by the server (part of the Git protocol)
 * @property {Object} [refs]
 * @property {string} [HEAD] - The default branch of the remote
 * @property {Object<string, string>} [refs.heads] - The branches on the remote
 * @property {Object<string, string>} [refs.pull] - The special branches representing pull requests (non-standard)
 * @property {Object<string, string>} [refs.tags] - The tags on the remote
 *
 */
/**
 * List a remote servers branches, tags, and capabilities.
 *
 * This is a rare command that doesn't require an `fs`, `dir`, or even `gitdir` argument.
 * It just communicates to a remote git server, using the first step of the `git-upload-pack` handshake, but stopping short of fetching the packfile.
 *
 * @param {object} args
 * @param {HttpClient} args.http - an HTTP client
 * @param {AuthCallback} [args.onAuth] - optional auth fill callback
 * @param {AuthFailureCallback} [args.onAuthFailure] - optional auth rejected callback
 * @param {AuthSuccessCallback} [args.onAuthSuccess] - optional auth approved callback
 * @param {string} args.url - The URL of the remote repository. Will be gotten from gitconfig if absent.
 * @param {string} [args.corsProxy] - Optional [CORS proxy](https://www.npmjs.com/%40isomorphic-git/cors-proxy). Overrides value in repo config.
 * @param {boolean} [args.forPush = false] - By default, the command queries the 'fetch' capabilities. If true, it will ask for the 'push' capabilities.
 * @param {Object<string, string>} [args.headers] - Additional headers to include in HTTP requests, similar to git's `extraHeader` config
 *
 * @returns {Promise<GetRemoteInfoResult>} Resolves successfully with an object listing the branches, tags, and capabilities of the remote.
 * @see GetRemoteInfoResult
 *
 * @example
 * let info = await git.getRemoteInfo({
 *   http,
 *   url:
 *     "https://cors.isomorphic-git.org/github.com/isomorphic-git/isomorphic-git.git"
 * });
 * console.log(info);
 *
 */
export function getRemoteInfo({ http, onAuth, onAuthSuccess, onAuthFailure, corsProxy, url, headers, forPush, }: {
    http: HttpClient;
    onAuth?: any;
    onAuthFailure?: any;
    onAuthSuccess?: any;
    url: string;
    corsProxy?: string | undefined;
    forPush?: boolean | undefined;
    headers?: {
        [x: string]: string;
    } | undefined;
}): Promise<GetRemoteInfoResult>;
/**
 * - The object returned has the following schema:
 */
export type GetRemoteInfoResult = {
    /**
     * - The list of capabilities returned by the server (part of the Git protocol)
     */
    capabilities: string[];
    refs?: any;
    /**
     * - The default branch of the remote
     */
    HEAD?: string | undefined;
    /**
     * - The branches on the remote
     */
    heads?: {
        [x: string]: string;
    } | undefined;
    /**
     * - The special branches representing pull requests (non-standard)
     */
    pull?: {
        [x: string]: string;
    } | undefined;
    /**
     * - The tags on the remote
     */
    tags?: {
        [x: string]: string;
    } | undefined;
};
