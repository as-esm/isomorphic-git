/**
 * Blob parser - trivial passthrough since blobs are just raw content
 */

/**
 * Parses a blob buffer (trivial passthrough)
 */
export const parse = (buffer: Buffer | Uint8Array): Buffer => {
  return Buffer.from(buffer)
}

/**
 * Serializes a blob (trivial passthrough)
 */
export const serialize = (content: Buffer | Uint8Array | string): Buffer => {
  if (typeof content === 'string') {
    return Buffer.from(content, 'utf8')
  }
  return Buffer.from(content)
}

