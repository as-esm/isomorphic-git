/**
 * Normalizes a filepath to use forward slashes (Git convention)
 */
export const normalize = (filepath: string): string => {
  return filepath.replace(/\\/g, '/')
}

/**
 * Normalizes a filepath buffer to use forward slashes
 */
export const normalizeBuffer = (buffer: Uint8Array | Buffer): Uint8Array | Buffer => {
  let idx: number
  while (~(idx = buffer.indexOf(92))) buffer[idx] = 47
  return buffer
}

/**
 * Converts a full SHA OID to its object path components
 */
export const toOid = (oid: string): { dir: string; file: string } => {
  if (oid.length !== 40) {
    throw new Error(`Invalid OID length: expected 40, got ${oid.length}`)
  }
  return {
    dir: oid.slice(0, 2),
    file: oid.slice(2),
  }
}

/**
 * Constructs the object path from an OID
 */
export const toObjectPath = (oid: string): string => {
  const { dir, file } = toOid(oid)
  return `objects/${dir}/${file}`
}

/**
 * Joins path segments with forward slashes
 */
export const join = (...args: string[]): string => {
  if (args.length === 0) return '.'
  let joined: string | undefined
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i]
    if (arg.length > 0) {
      if (joined === undefined) joined = arg
      else joined += '/' + arg
    }
  }
  if (joined === undefined) return '.'
  return normalize(joined)
}

