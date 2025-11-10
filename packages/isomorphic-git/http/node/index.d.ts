import '../../typedefs-http.js';
/**
 * HttpClient
 *
 * @param {GitHttpRequest} request
 * @returns {Promise<GitHttpResponse>}
 */
export declare function request({ onProgress, url, method, headers, agent, body, }: {
    onProgress: any;
    url: any;
    method?: string | undefined;
    headers?: {} | undefined;
    agent: any;
    body: any;
}): Promise<unknown>;
declare const _default: {
    request: typeof request;
};
export default _default;
