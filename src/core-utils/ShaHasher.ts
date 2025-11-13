import Hash from 'sha.js/sha1.js'
import { toHex } from '../utils/toHex.js'

let supportsSubtleSHA1: boolean | null = null

/**
 * Computes the SHA-1 hash of a buffer
 */
export const shasum = async (buffer: Uint8Array | Buffer): Promise<string> => {
  if (supportsSubtleSHA1 === null) {
    supportsSubtleSHA1 = await testSubtleSHA1()
  }
  return supportsSubtleSHA1 ? subtleSHA1(buffer) : shasumSync(buffer)
}

const shasumSync = (buffer: Uint8Array | Buffer): string => {
  return new Hash().update(buffer).digest('hex')
}

const subtleSHA1 = async (buffer: Uint8Array | Buffer): Promise<string> => {
  const hash = await crypto.subtle.digest('SHA-1', buffer)
  return toHex(hash)
}

const testSubtleSHA1 = async (): Promise<boolean> => {
  try {
    const hash = await subtleSHA1(new Uint8Array([]))
    return hash === 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
  } catch {
    return false
  }
}

/**
 * Hashes a Git object by prepending the Git header and computing SHA-1
 */
export const hashObject = async ({
  type,
  content,
}: {
  type: string
  content: Uint8Array | Buffer
}): Promise<string> => {
  const header = `${type} ${content.length}\x00`
  const headerLen = header.length
  const totalLength = headerLen + content.length

  const wrappedObject = new Uint8Array(totalLength)
  for (let i = 0; i < headerLen; i++) {
    wrappedObject[i] = header.charCodeAt(i)
  }
  wrappedObject.set(content, headerLen)

  return await shasum(wrappedObject)
}

