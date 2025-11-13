/* eslint-env node, browser */
import Hash from 'sha.js/sha1.js'

import { toHex } from './toHex.ts'

let supportsSubtleSHA1: boolean | null = null

export const shasum = async (buffer: Buffer | Uint8Array): Promise<string> => {
  if (supportsSubtleSHA1 === null) {
    supportsSubtleSHA1 = await testSubtleSHA1()
  }
  return supportsSubtleSHA1 ? subtleSHA1(buffer) : shasumSync(buffer)
}

// This is modeled after @dominictarr's "shasum" module,
// but without the 'json-stable-stringify' dependency and
// extra type-casting features.
const shasumSync = (buffer: Buffer | Uint8Array): string => {
  return new Hash().update(buffer).digest('hex')
}

const subtleSHA1 = async (buffer: Buffer | Uint8Array): Promise<string> => {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const hash = await crypto.subtle.digest('SHA-1', buf)
  return toHex(hash)
}

const testSubtleSHA1 = async (): Promise<boolean> => {
  // I'm using a rather crude method of progressive enhancement, because
  // some browsers that have crypto.subtle.digest don't actually implement SHA-1.
  try {
    const hash = await subtleSHA1(new Uint8Array([]))
    return hash === 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
  } catch {
    // no bother
  }
  return false
}

