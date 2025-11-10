/* eslint-env browser */
import '../../typedefs-http.ts'
import type {GitHttpRequest, GitHttpResponse} from '../../typedefs-http.ts'
import { collect } from '../../utils/collect.js'
import { fromStream } from '../../utils/fromStream.js'

/**
 * HttpClient
 *
 * @param {GitHttpRequest} request
 * @returns {Promise<GitHttpResponse>}
 */
export async function request({
  onProgress,
  url,
  method = 'GET',
  headers = {},
  body,
}) {
  // streaming uploads aren't possible yet in the browser
  if (body) {
    body = await collect(body)
  }
  const res = await fetch(url, { method, headers, body })
  const iter =
    // @ts-expect-error getReader is not always defined 
    res.body && res.body.getReader
      ? fromStream(res.body)
      : [new Uint8Array(await res.arrayBuffer())]
  // convert Header object to ordinary JSON
  headers = {}
  // @ts-expect-error entries does exist on headers.
  for (const [key, value] of res.headers.entries()) {
    headers[key] = value
  }

  return {
    url: res.url,
    statusCode: res.status,
    statusMessage: res.statusText,
    body: iter,
    headers: headers,
  }
}

export default { request }
