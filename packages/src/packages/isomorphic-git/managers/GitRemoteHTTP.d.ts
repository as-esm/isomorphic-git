export class GitRemoteHTTP {
    /**
     * Returns the capabilities of the GitRemoteHTTP class.
     *
     * @returns {Promise<string[]>} - An array of supported capabilities.
     */
    static capabilities(): Promise<string[]>;
    /**
     * Discovers references from a remote Git repository.
     *
     * @param {Object} args
     * @param {HttpClient} args.http - The HTTP client to use for requests.
     * @param {ProgressCallback} [args.onProgress] - Callback for progress updates.
     * @param {AuthCallback} [args.onAuth] - Callback for providing authentication credentials.
     * @param {AuthFailureCallback} [args.onAuthFailure] - Callback for handling authentication failures.
     * @param {AuthSuccessCallback} [args.onAuthSuccess] - Callback for handling successful authentication.
     * @param {string} [args.corsProxy] - Optional CORS proxy URL.
     * @param {string} args.service - The Git service (e.g., "git-upload-pack").
     * @param {string} args.url - The URL of the remote repository.
     * @param {Object<string, string>} args.headers - HTTP headers to include in the request.
     * @param {1 | 2} args.protocolVersion - The Git protocol version to use.
     * @returns {Promise<Object>} - The parsed response from the remote repository.
     * @throws {HttpError} - If the HTTP request fails.
     * @throws {SmartHttpError} - If the response cannot be parsed.
     * @throws {UserCanceledError} - If the user cancels the operation.
     */
    static discover({ http, onProgress, onAuth, onAuthSuccess, onAuthFailure, corsProxy, service, url: _origUrl, headers, protocolVersion, }: {
        http: HttpClient;
        onProgress?: any;
        onAuth?: any;
        onAuthFailure?: any;
        onAuthSuccess?: any;
        corsProxy?: string | undefined;
        service: string;
        url: string;
        headers: {
            [x: string]: string;
        };
        protocolVersion: 1 | 2;
    }): Promise<any>;
    /**
     * Connects to a remote Git repository and sends a request.
     *
     * @param {Object} args
     * @param {HttpClient} args.http - The HTTP client to use for requests.
     * @param {ProgressCallback} [args.onProgress] - Callback for progress updates.
     * @param {string} [args.corsProxy] - Optional CORS proxy URL.
     * @param {string} args.service - The Git service (e.g., "git-upload-pack").
     * @param {string} args.url - The URL of the remote repository.
     * @param {Object<string, string>} [args.headers] - HTTP headers to include in the request.
     * @param {any} args.body - The request body to send.
     * @param {any} args.auth - Authentication credentials.
     * @returns {Promise<GitHttpResponse>} - The HTTP response from the remote repository.
     * @throws {HttpError} - If the HTTP request fails.
     */
    static connect({ http, onProgress, corsProxy, service, url, auth, body, headers, }: {
        http: HttpClient;
        onProgress?: any;
        corsProxy?: string | undefined;
        service: string;
        url: string;
        headers?: {
            [x: string]: string;
        } | undefined;
        body: any;
        auth: any;
    }): Promise<GitHttpResponse>;
}
