import get from 'simple-get'

import { asyncIteratorToStream } from "../../utils/asyncIteratorToStream.ts"
import { collect } from "../../utils/collect.ts"
import { fromNodeStream } from "../../utils/fromNodeStream.ts"
import type { GitHttpRequest, GitHttpResponse } from "../../git/remote/GitRemoteHTTP.ts"

/**
 * HttpClient for Node.js environment
 *
 * @param {GitHttpRequest} request
 * @returns {Promise<GitHttpResponse>}
 */
export async function request({
  onProgress,
  url,
  method = 'GET',
  headers = {},
  agent,
  body,
}: GitHttpRequest): Promise<GitHttpResponse> {
  // If we can, we should send it as a single buffer so it sets a Content-Length header.
  let requestBody: Buffer | any = body
  if (body && Array.isArray(body)) {
    requestBody = Buffer.from(await collect(body))
  } else if (body) {
    requestBody = asyncIteratorToStream(body)
  }
  return new Promise<GitHttpResponse>((resolve, reject) => {
    get(
      {
        url,
        method,
        headers,
        agent,
        body: requestBody,
      },
      (err: Error | null, res: any) => {
        if (err) return reject(err)
        try {
          const iter = fromNodeStream(res)
          resolve({
            url: res.url,
            method: res.method,
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            body: iter,
            headers: res.headers,
          })
        } catch (e) {
          reject(e)
        }
      }
    )
  })
}

export default { request }

