import pify from 'pify'

import { compareStrings } from '../utils/compareStrings.js'
import { dirname } from '../utils/dirname.js'
import { rmRecursive } from '../utils/rmRecursive.js'
import { isPromiseLike } from '../utils/types.js'

// ============================================================================
// FILESYSTEM CLIENT TYPES
// ============================================================================

/**
 * Filesystem client that uses callback-style API (Node.js fs module style)
 */
export type CallbackFsClient = {
  readFile: (path: string, options: unknown, callback: (err: Error | null, data: Buffer | string) => void) => void
  writeFile: (file: string, data: Buffer | string, options: unknown, callback: (err: Error | null) => void) => void
  unlink: (path: string, callback: (err: Error | null) => void) => void
  readdir: (path: string, options: unknown, callback: (err: Error | null, files: string[]) => void) => void
  mkdir: (path: string, mode: unknown, callback: (err: Error | null) => void) => void
  rmdir: (path: string, callback: (err: Error | null) => void) => void
  stat: (path: string, callback: (err: Error | null, stats: unknown) => void) => void
  lstat: (path: string, callback: (err: Error | null, stats: unknown) => void) => void
  readlink?: (path: string, callback: (err: Error | null, linkString: string) => void) => void
  symlink?: (target: string, path: string, type: unknown, callback: (err: Error | null) => void) => void
  chmod?: (path: string, mode: unknown, callback: (err: Error | null) => void) => void
}

/**
 * Filesystem client that uses promise-style API (Node.js fs.promises style)
 */
export type PromiseFsClient = {
  promises: {
    readFile: (path: string, options?: unknown) => Promise<Buffer | string>
    writeFile: (file: string, data: Buffer | string, options?: unknown) => Promise<void>
    unlink: (path: string) => Promise<void>
    readdir: (path: string, options?: unknown) => Promise<string[]>
    mkdir: (path: string, options?: unknown) => Promise<void>
    rmdir: (path: string) => Promise<void>
    stat: (path: string, options?: unknown) => Promise<unknown>
    lstat: (path: string, options?: unknown) => Promise<unknown>
    readlink?: (path: string, options?: unknown) => Promise<string>
    symlink?: (target: string, path: string, type?: unknown) => Promise<void>
    chmod?: (path: string, mode: unknown) => Promise<void>
  }
}

/**
 * Union type for filesystem clients - supports both callback and promise styles
 */
export type FsClient = CallbackFsClient | PromiseFsClient

/**
 * Normalized subset of filesystem `stat` data
 */
export type Stat = {
  ctimeSeconds: number
  ctimeNanoseconds: number
  mtimeSeconds: number
  mtimeNanoseconds: number
  dev: number
  ino: number
  mode: number
  uid: number
  gid: number
  size: number
}

function isPromiseFs(fs: FsClient): boolean {
  const test = (targetFs: FsClient) => {
    try {
      // If readFile returns a promise then we can probably assume the other
      // commands do as well
      if ('promises' in targetFs && targetFs.promises) {
        return targetFs.promises.readFile('').catch((e: unknown) => e)
      }
      return Promise.resolve()
    } catch (e) {
      return e
    }
  }
  return isPromiseLike(test(fs))
}

// List of commands all filesystems are expected to provide. `rm` is not
// included since it may not exist and must be handled as a special case
const commands = [
  'readFile',
  'writeFile',
  'mkdir',
  'rmdir',
  'unlink',
  'stat',
  'lstat',
  'readdir',
  'readlink',
  'symlink',
] as const

function bindFs(
  target: FileSystem,
  fs: FsClient | { [key: string]: (...args: unknown[]) => unknown }
): void {
  if (isPromiseFs(fs as FsClient)) {
    for (const command of commands) {
      const fsObj = fs as { [key: string]: (...args: unknown[]) => unknown }
      if (fsObj[command]) {
        ;(target as any)[`_${command}`] = fsObj[command].bind(fs)
      }
    }
  } else {
    for (const command of commands) {
      const fsObj = fs as { [key: string]: (...args: unknown[]) => unknown }
      if (fsObj[command]) {
        ;(target as any)[`_${command}`] = pify(fsObj[command].bind(fs))
      }
    }
  }

  // Handle the special case of `rm`
  if (isPromiseFs(fs as FsClient)) {
    const fsObj = fs as { rm?: (...args: unknown[]) => unknown; rmdir?: (...args: unknown[]) => unknown }
    if (fsObj.rm) {
      ;(target as any)._rm = fsObj.rm.bind(fs)
    } else if (fsObj.rmdir && fsObj.rmdir.length > 1) {
      ;(target as any)._rm = fsObj.rmdir.bind(fs)
    } else {
      ;(target as any)._rm = rmRecursive.bind(null, target)
    }
  } else {
    const fsObj = fs as { rm?: (...args: unknown[]) => unknown; rmdir?: (...args: unknown[]) => unknown }
    if (fsObj.rm) {
      ;(target as any)._rm = pify(fsObj.rm.bind(fs))
    } else if (fsObj.rmdir && fsObj.rmdir.length > 2) {
      ;(target as any)._rm = pify(fsObj.rmdir.bind(fs))
    } else {
      ;(target as any)._rm = rmRecursive.bind(null, target)
    }
  }
}

/**
 * A wrapper class for file system operations, providing a consistent API for both promise-based
 * and callback-based file systems. It includes utility methods for common file system tasks.
 */
export class FileSystem {
  _original_unwrapped_fs?: FsClient
  _readFile?: (path: string, options?: unknown) => Promise<Buffer | string>
  _writeFile?: (file: string, data: Buffer | string, options?: unknown) => Promise<void>
  _mkdir?: (path: string, mode?: unknown) => Promise<void>
  _rmdir?: (path: string) => Promise<void>
  _unlink?: (path: string) => Promise<void>
  _stat?: (path: string) => Promise<Stat>
  _lstat?: (path: string) => Promise<Stat | null>
  _readdir?: (path: string, options?: unknown) => Promise<string[]>
  _readlink?: (path: string, options?: unknown) => Promise<string | Buffer>
  _symlink?: (target: string, path: string, type?: unknown) => Promise<void>
  _rm?: (path: string, opts?: { recursive?: boolean }) => Promise<void>

  /**
   * Creates an instance of FileSystem.
   */
  constructor(fs: FsClient) {
    if (typeof (fs as any)._original_unwrapped_fs !== 'undefined') {
      return fs as unknown as FileSystem
    }

    const promises = Object.getOwnPropertyDescriptor(fs, 'promises')
    if (promises && promises.enumerable) {
      bindFs(this, (fs as any).promises)
    } else {
      bindFs(this, fs)
    }
    this._original_unwrapped_fs = fs
  }

  /**
   * Return true if a file exists, false if it doesn't exist.
   * Rethrows errors that aren't related to file existence.
   */
  async exists(filepath: string, options: Record<string, unknown> = {}): Promise<boolean> {
    try {
      await this._stat!(filepath)
      return true
    } catch (err: unknown) {
      const error = err as { code?: string }
      if (
        error.code === 'ENOENT' ||
        error.code === 'ENOTDIR' ||
        (error.code || '').includes('ENS')
      ) {
        return false
      } else {
        console.log('Unhandled error in "FileSystem.exists()" function', err)
        throw err
      }
    }
  }

  /**
   * Return the contents of a file if it exists, otherwise returns null.
   */
  async read(
    filepath: string,
    options: { encoding?: string; autocrlf?: string } = {}
  ): Promise<Buffer | string | null> {
    try {
      let buffer: Buffer | string | Uint8Array = await this._readFile!(filepath, options)
      if (options.autocrlf === 'true') {
        try {
          buffer = new TextDecoder('utf8', { fatal: true }).decode(
            buffer as Uint8Array
          )
          buffer = buffer.replace(/\r\n/g, '\n')
          buffer = new TextEncoder().encode(buffer as string)
        } catch (error) {
          // non utf8 file
        }
      }
      // Convert plain ArrayBuffers to Buffers
      if (typeof buffer !== 'string') {
        buffer = Buffer.from(buffer as Uint8Array)
      }
      return buffer as Buffer | string
    } catch (err) {
      return null
    }
  }

  /**
   * Write a file (creating missing directories if need be) without throwing errors.
   */
  async write(
    filepath: string,
    contents: Buffer | Uint8Array | string,
    options: Record<string, unknown> | string = {}
  ): Promise<void> {
    try {
      await this._writeFile!(filepath, contents as Buffer | string, options)
    } catch (err) {
      // Hmm. Let's try mkdirp and try again.
      await this.mkdir(dirname(filepath))
      await this._writeFile!(filepath, contents as Buffer | string, options)
    }
  }

  /**
   * Make a directory (or series of nested directories) without throwing an error if it already exists.
   */
  async mkdir(filepath: string, _selfCall = false): Promise<void> {
    try {
      await this._mkdir!(filepath)
    } catch (err: unknown) {
      const error = err as { code?: string } | null
      // If err is null then operation succeeded!
      if (error === null) return
      // If the directory already exists, that's OK!
      if (error.code === 'EEXIST') return
      // Avoid infinite loops of failure
      if (_selfCall) throw err
      // If we got a "no such file or directory error" backup and try again.
      if (error.code === 'ENOENT') {
        const parent = dirname(filepath)
        // Check to see if we've gone too far
        if (parent === '.' || parent === '/' || parent === filepath) throw err
        // Infinite recursion, what could go wrong?
        await this.mkdir(parent)
        await this.mkdir(filepath, true)
      }
    }
  }

  /**
   * Delete a file without throwing an error if it is already deleted.
   */
  async rm(filepath: string): Promise<void> {
    try {
      await this._unlink!(filepath)
    } catch (err: unknown) {
      const error = err as { code?: string }
      if (error.code !== 'ENOENT') throw err
    }
  }

  /**
   * Delete a directory without throwing an error if it is already deleted.
   */
  async rmdir(
    filepath: string,
    opts?: { recursive?: boolean }
  ): Promise<void> {
    try {
      if (opts && opts.recursive) {
        await this._rm!(filepath, opts)
      } else {
        await this._rmdir!(filepath)
      }
    } catch (err: unknown) {
      const error = err as { code?: string }
      if (error.code !== 'ENOENT') throw err
    }
  }

  /**
   * Read a directory without throwing an error is the directory doesn't exist
   */
  async readdir(filepath: string): Promise<string[] | null> {
    try {
      const names = await this._readdir!(filepath)
      // Ordering is not guaranteed, and system specific (Windows vs Unix)
      // so we must sort them ourselves.
      names.sort(compareStrings)
      return names
    } catch (err: unknown) {
      const error = err as { code?: string }
      if (error.code === 'ENOTDIR') return null
      return []
    }
  }

  /**
   * Return a flat list of all the files nested inside a directory
   *
   * Based on an elegant concurrent recursive solution from SO
   * https://stackoverflow.com/a/45130990/2168416
   */
  async readdirDeep(dir: string): Promise<string[]> {
    const subdirs = await this._readdir!(dir)
    const files = await Promise.all(
      subdirs.map(async (subdir: string) => {
        const res = dir + '/' + subdir
        const stats = await this._stat!(res)
        return (stats as any).isDirectory()
          ? this.readdirDeep(res)
          : res
      })
    )
    return files.flat() as string[]
  }

  /**
   * Return the Stats of a file/symlink if it exists, otherwise returns null.
   * Rethrows errors that aren't related to file existence.
   */
  async lstat(filename: string): Promise<Stat | null> {
    try {
      const stats = await this._lstat!(filename)
      return stats
    } catch (err: unknown) {
      const error = err as { code?: string }
      if (error.code === 'ENOENT' || (error.code || '').includes('ENS')) {
        return null
      }
      throw err
    }
  }

  /**
   * Reads the contents of a symlink if it exists, otherwise returns null.
   * Rethrows errors that aren't related to file existence.
   */
  async readlink(
    filename: string,
    opts: { encoding?: string } = { encoding: 'buffer' }
  ): Promise<Buffer | null> {
    // Note: FileSystem.readlink returns a buffer by default
    // so we can dump it into GitObject.write just like any other file.
    try {
      const link = await this._readlink!(filename, opts)
      return Buffer.isBuffer(link) ? link : Buffer.from(link as string | Uint8Array)
    } catch (err: unknown) {
      const error = err as { code?: string }
      if (error.code === 'ENOENT' || (error.code || '').includes('ENS')) {
        return null
      }
      throw err
    }
  }

  /**
   * Write the contents of buffer to a symlink.
   */
  async writelink(filename: string, buffer: Buffer): Promise<void> {
    return this._symlink!(buffer.toString('utf8'), filename)
  }
}

