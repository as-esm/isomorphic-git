/**
 * HttpClient
 *
 * @param {GitHttpRequest} request
 * @returns {Promise<GitHttpResponse>}
 */
export function request({ onProgress, url, method, headers, body, }: GitHttpRequest): Promise<GitHttpResponse>;
declare namespace _default {
    export { request };
}
export default _default;
