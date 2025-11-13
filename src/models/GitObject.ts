import { InternalError } from '../errors/InternalError.js'

// ============================================================================
// GIT OBJECT TYPES
// ============================================================================

/**
 * Git object type identifiers
 */
export type ObjectType = 'commit' | 'blob' | 'tree' | 'tag'

/**
 * Represents a Git object and provides methods to wrap and unwrap Git objects
 * according to the Git object format.
 */
export class GitObject {
  /**
   * Wraps a raw object with a Git header.
   */
  static wrap({ type, object }: { type: string; object: Uint8Array | Buffer }): Uint8Array {
    const header = `${type} ${object.length}\x00`
    const headerLen = header.length
    const totalLength = headerLen + object.length

    // Allocate a single buffer for the header and object, rather than create multiple buffers
    const wrappedObject = new Uint8Array(totalLength)
    for (let i = 0; i < headerLen; i++) {
      wrappedObject[i] = header.charCodeAt(i)
    }
    wrappedObject.set(object, headerLen)

    return wrappedObject
  }

  /**
   * Unwraps a Git object buffer into its type and raw object data.
   */
  static unwrap(buffer: Buffer | Uint8Array): { type: string; object: Buffer } {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
    const s = buf.indexOf(32) // first space
    const i = buf.indexOf(0) // first null value
    const type = buf.slice(0, s).toString('utf8') // get type of object
    const length = buf.slice(s + 1, i).toString('utf8') // get type of object
    const actualLength = buf.length - (i + 1)
    // verify length
    if (parseInt(length, 10) !== actualLength) {
      throw new InternalError(
        `Length mismatch: expected ${length} bytes but got ${actualLength} instead.`
      )
    }
    return {
      type,
      object: Buffer.from(buf.slice(i + 1)),
    }
  }
}

