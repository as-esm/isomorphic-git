/**
 * @typedef {Object} GetRemoteInfo2Result - This object has the following schema:
 * @property {1 | 2} protocolVersion - Git protocol version the server supports
 * @property {Object<string, string | true>} capabilities - An object of capabilities represented as keys and values
 * @property {ServerRef[]} [refs] - Server refs (they get returned by protocol version 1 whether you want them or not)
 */
/**
 * List a remote server's capabilities.
 *
 * This is a rare command that doesn't require an `fs`, `dir`, or even `gitdir` argument.
 * It just communicates to a remote git server, determining what protocol version, commands, and features it supports.
 *
 * > The successor to [`getRemoteInfo`](./getRemoteInfo.md), this command supports Git Wire Protocol Version 2.
 * > Therefore its return type is more complicated as either:
 * >
 * > - v1 capabilities (and refs) or
 * > - v2 capabilities (and no refs)
 * >
 * > are returned.
 * > If you just care about refs, use [`listServerRefs`](./listServerRefs.md)
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
 * @param {1 | 2} [args.protocolVersion = 2] - Which version of the Git Protocol to use.
 *
 * @returns {Promise<GetRemoteInfo2Result>} Resolves successfully with an object listing the capabilities of the remote.
 * @see GetRemoteInfo2Result
 * @see ServerRef
 *
 * @example
 * let info = await git.getRemoteInfo2({
 *   http,
 *   corsProxy: "https://cors.isomorphic-git.org",
 *   url: "https://github.com/isomorphic-git/isomorphic-git.git"
 * });
 * console.log(info);
 *
 */
export function getRemoteInfo2({ http, onAuth, onAuthSuccess, onAuthFailure, corsProxy, url, headers, forPush, protocolVersion, }: {
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
    protocolVersion?: 1 | 2 | undefined;
}): Promise<GetRemoteInfo2Result>;
/**
 * - This object has the following schema:
 */
export type GetRemoteInfo2Result = {
    /**
     * - Git protocol version the server supports
     */
    protocolVersion: 1 | 2;
    /**
     * - An object of capabilities represented as keys and values
     */
    capabilities: {
        [x: string]: string | true;
    };
    /**
     * - Server refs (they get returned by protocol version 1 whether you want them or not)
     */
    refs?: ServerRef[] | undefined;
};
