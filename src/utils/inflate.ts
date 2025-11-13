/* eslint-env node, browser */
/* global DecompressionStream */
import pako from 'pako'

let supportsDecompressionStream: boolean | null = null

export const inflate = async (buffer: Buffer | Uint8Array): Promise<Uint8Array> => {
  if (supportsDecompressionStream === null) {
    supportsDecompressionStream = testDecompressionStream()
  }
  return supportsDecompressionStream ? browserInflate(buffer) : pako.inflate(buffer)
}

const browserInflate = async (buffer: Buffer | Uint8Array): Promise<Uint8Array> => {
  const ds = new DecompressionStream('deflate')
  const blob = Buffer.isBuffer(buffer) ? new Blob([buffer]) : new Blob([buffer])
  const d = blob.stream().pipeThrough(ds)
  return new Uint8Array(await new Response(d).arrayBuffer())
}

const testDecompressionStream = (): boolean => {
  try {
    const ds = new DecompressionStream('deflate')
    if (ds) return true
  } catch {
    // no bother
  }
  return false
}

