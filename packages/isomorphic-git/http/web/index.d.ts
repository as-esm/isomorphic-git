import '../../typedefs-http.ts';
/**
 * HttpClient
 *
 * @param {GitHttpRequest} request
 * @returns {Promise<GitHttpResponse>}
 */
export declare function request({ onProgress, url, method, headers, body, }: {
    onProgress: any;
    url: any;
    method?: string | undefined;
    headers?: {} | undefined;
    body: any;
}): Promise<{
    url: string;
    statusCode: number;
    statusMessage: string;
    body: any;
    headers: {};
}>;
declare const _default: {
    request: typeof request;
};
export default _default;
