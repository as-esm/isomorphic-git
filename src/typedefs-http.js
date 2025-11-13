/**
 * @fileoverview HTTP-related type definitions
 * These JSDoc types are kept for backward compatibility with JavaScript files.
 * The source of truth is src/managers/GitRemoteHTTP.ts - these should match the TypeScript definitions.
 * The types are re-exported from src/types.js for backward compatibility.
 * 
 * @see {import('./types.js').GitProgressEvent}
 * @see {import('./types.js').ProgressCallback}
 * @see {import('./types.js').GitHttpRequest}
 * @see {import('./types.js').GitHttpResponse}
 * @see {import('./types.js').HttpFetch}
 * @see {import('./types.js').HttpClient}
 */

/**
 * @typedef {Object} GitProgressEvent
 * @property {string} phase
 * @property {number} loaded
 * @property {number} total
 */

/**
 * @callback ProgressCallback
 * @param {GitProgressEvent} progress
 * @returns {void | Promise<void>}
 */

/**
 * @typedef {Object} GitHttpRequest
 * @property {string} url - The URL to request
 * @property {string} [method='GET'] - The HTTP method to use
 * @property {Object<string, string>} [headers={}] - Headers to include in the HTTP request
 * @property {Object} [agent] - An HTTP or HTTPS agent that manages connections for the HTTP client (Node.js only)
 * @property {AsyncIterableIterator<Uint8Array>} [body] - An async iterator of Uint8Arrays that make up the body of POST requests
 * @property {ProgressCallback} [onProgress] - Reserved for future use (emitting `GitProgressEvent`s)
 * @property {object} [signal] - Reserved for future use (canceling a request)
 */

/**
 * @typedef {Object} GitHttpResponse
 * @property {string} url - The final URL that was fetched after any redirects
 * @property {string} [method] - The HTTP method that was used
 * @property {Object<string, string>} [headers] - HTTP response headers
 * @property {AsyncIterableIterator<Uint8Array>} [body] - An async iterator of Uint8Arrays that make up the body of the response
 * @property {number} statusCode - The HTTP status code
 * @property {string} statusMessage - The HTTP status message
 */

/**
 * @callback HttpFetch
 * @param {GitHttpRequest} request
 * @returns {Promise<GitHttpResponse>}
 */

/**
 * @typedef {Object} HttpClient
 * @property {HttpFetch} request
 */
