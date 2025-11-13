import { InvalidOidError } from "../../errors/InvalidOidError.ts"
import { NotFoundError } from "../../errors/NotFoundError.ts"
import { parsePackedRefs } from './RefParser.js'
import { join } from '../GitPath.js'
import AsyncLock from 'async-lock'
import type { FsClient } from "../../models/FileSystem.ts"

// @see https://git-scm.com/docs/git-rev-parse.html#_specifying_revisions
const refpaths = (ref: string): string[] => [
  `${ref}`,
  `refs/${ref}`,
  `refs/tags/${ref}`,
  `refs/heads/${ref}`,
  `refs/remotes/${ref}`,
  `refs/remotes/${ref}/HEAD`,
]

// @see https://git-scm.com/docs/gitrepository-layout
const GIT_FILES = ['config', 'description', 'index', 'shallow', 'commondir']

let lock: AsyncLock | undefined

const acquireLock = async <T>(ref: string, callback: () => Promise<T>): Promise<T> => {
  if (lock === undefined) lock = new AsyncLock()
  return lock.acquire(ref, callback)
}

/**
 * High-level facade for all reference operations
 */
export class RefManager {
  /**
   * Resolves a ref to its object ID
   */
  static async resolve({
    fs,
    gitdir,
    ref,
    depth,
  }: {
    fs: FsClient
    gitdir: string
    ref: string
    depth?: number
  }): Promise<string> {
    if (depth !== undefined) {
      depth--
      if (depth === -1) {
        return ref
      }
    }

    // Is it a ref pointer?
    if (ref.startsWith('ref: ')) {
      ref = ref.slice('ref: '.length)
      return RefManager.resolve({ fs, gitdir, ref, depth })
    }

    // Is it a complete and valid SHA?
    if (ref.length === 40 && /[0-9a-f]{40}/.test(ref)) {
      return ref
    }

    // We need to alternate between the file system and the packed-refs
    const packedMap = await RefManager.packedRefs({ fs, gitdir })
    // Look in all the proper paths, in this order
    const allpaths = refpaths(ref).filter(p => !GIT_FILES.includes(p)) // exclude git system files

    for (const refPath of allpaths) {
      const sha = await acquireLock(refPath, async () => {
        try {
          const looseRef = await fs.read(`${gitdir}/${refPath}`, { encoding: 'utf8' })
          if (looseRef) {
            return looseRef as string
          }
        } catch {
          // File doesn't exist, try packed refs
        }
        return packedMap.get(refPath) ?? null
      })
      if (sha) {
        return RefManager.resolve({ fs, gitdir, ref: String(sha).trim(), depth })
      }
    }

    // Do we give up?
    throw new NotFoundError(ref)
  }

  /**
   * Lists all refs matching a given filepath prefix
   */
  static async listRefs({
    fs,
    gitdir,
    filepath,
  }: {
    fs: FsClient
    gitdir: string
    filepath: string
  }): Promise<string[]> {
    const packedMap = await RefManager.packedRefs({ fs, gitdir })
    let files: string[] = []

    try {
      const readdirResult = await fs.readdirDeep(`${gitdir}/${filepath}`)
      files = (readdirResult as string[]).map(x => x.replace(`${gitdir}/${filepath}/`, ''))
    } catch {
      // Directory doesn't exist, that's okay
    }

    for (let key of packedMap.keys()) {
      // filter by prefix
      if (key.startsWith(filepath)) {
        // remove prefix
        key = key.replace(filepath + '/', '')
        // Don't include duplicates; the loose files have precedence anyway
        if (!files.includes(key)) {
          files.push(key)
        }
      }
    }

    // Sort them
    files.sort()
    return files
  }

  /**
   * Writes a ref to the file system
   */
  static async writeRef({
    fs,
    gitdir,
    ref,
    value,
  }: {
    fs: FsClient
    gitdir: string
    ref: string
    value: string
  }): Promise<void> {
    // Validate input
    if (!value.match(/[0-9a-f]{40}/)) {
      throw new InvalidOidError(value)
    }
    await acquireLock(ref, async () => fs.write(join(gitdir, ref), `${value.trim()}\n`, 'utf8'))
  }

  /**
   * Writes a symbolic ref to the file system
   */
  static async writeSymbolicRef({
    fs,
    gitdir,
    ref,
    value,
  }: {
    fs: FsClient
    gitdir: string
    ref: string
    value: string
  }): Promise<void> {
    await acquireLock(ref, async () => fs.write(join(gitdir, ref), 'ref: ' + `${value.trim()}\n`, 'utf8'))
  }

  /**
   * Deletes a single ref
   */
  static async deleteRef({
    fs,
    gitdir,
    ref,
  }: {
    fs: FsClient
    gitdir: string
    ref: string
  }): Promise<void> {
    return RefManager.deleteRefs({ fs, gitdir, refs: [ref] })
  }

  /**
   * Deletes multiple refs
   */
  static async deleteRefs({
    fs,
    gitdir,
    refs,
  }: {
    fs: FsClient
    gitdir: string
    refs: string[]
  }): Promise<void> {
    // Delete regular refs
    await Promise.all(refs.map(ref => fs.rm(join(gitdir, ref))))

    // Delete any packed refs
    let text = await acquireLock('packed-refs', async () => {
      try {
        return (await fs.read(`${gitdir}/packed-refs`, { encoding: 'utf8' })) as string
      } catch {
        return ''
      }
    })
    const packed = parsePackedRefs(text)
    const beforeSize = packed.size

    for (const ref of refs) {
      packed.delete(ref)
    }

    if (packed.size < beforeSize) {
      text = serializePackedRefs(packed).toString('utf8')
      await acquireLock('packed-refs', async () =>
        fs.write(`${gitdir}/packed-refs`, text, { encoding: 'utf8' })
      )
    }
  }

  /**
   * Reads the packed refs file and returns a map of refs
   */
  static async packedRefs({
    fs,
    gitdir,
  }: {
    fs: FsClient
    gitdir: string
  }): Promise<Map<string, string>> {
    const text = await acquireLock('packed-refs', async () => {
      try {
        return (await fs.read(`${gitdir}/packed-refs`, { encoding: 'utf8' })) as string
      } catch {
        return ''
      }
    })
    return parsePackedRefs(text)
  }

  /**
   * Checks if a ref exists
   */
  static async exists({
    fs,
    gitdir,
    ref,
  }: {
    fs: FsClient
    gitdir: string
    ref: string
  }): Promise<boolean> {
    try {
      await RefManager.expand({ fs, gitdir, ref })
      return true
    } catch {
      return false
    }
  }

  /**
   * Expands a ref to its full name
   */
  static async expand({
    fs,
    gitdir,
    ref,
  }: {
    fs: FsClient
    gitdir: string
    ref: string
  }): Promise<string> {
    // Is it a complete and valid SHA?
    if (ref.length === 40 && /[0-9a-f]{40}/.test(ref)) {
      return ref
    }

    // We need to alternate between the file system and the packed-refs
    const packedMap = await RefManager.packedRefs({ fs, gitdir })
    // Look in all the proper paths, in this order
    const allpaths = refpaths(ref)

    for (const refPath of allpaths) {
      const refExists = await acquireLock(refPath, async () => fs.exists(`${gitdir}/${refPath}`))
      if (refExists) return refPath
      if (packedMap.has(refPath)) return refPath
    }

    // Do we give up?
    throw new NotFoundError(ref)
  }

  /**
   * Expands a ref against a provided map (for remote refs)
   */
  static expandAgainstMap({ ref, map }: { ref: string; map: Map<string, string> }): string {
    const allpaths = refpaths(ref)
    for (const refPath of allpaths) {
      if (map.has(refPath)) return refPath
    }
    throw new NotFoundError(ref)
  }

  /**
   * Resolves a ref against a provided map (for remote refs)
   */
  static resolveAgainstMap({
    ref,
    fullref = ref,
    depth,
    map,
  }: {
    ref: string
    fullref?: string
    depth?: number
    map: Map<string, string>
  }): { fullref: string; oid: string } {
    if (depth !== undefined) {
      depth--
      if (depth === -1) {
        return { fullref, oid: ref }
      }
    }

    // Is it a ref pointer?
    if (ref.startsWith('ref: ')) {
      ref = ref.slice('ref: '.length)
      return RefManager.resolveAgainstMap({ ref, fullref, depth, map })
    }

    // Is it a complete and valid SHA?
    if (ref.length === 40 && /[0-9a-f]{40}/.test(ref)) {
      return { fullref, oid: ref }
    }

    // Look in all the proper paths, in this order
    const allpaths = refpaths(ref)
    for (const refPath of allpaths) {
      const sha = map.get(refPath)
      if (sha) {
        return RefManager.resolveAgainstMap({
          ref: sha.trim(),
          fullref: refPath,
          depth,
          map,
        })
      }
    }

    // Do we give up?
    throw new NotFoundError(ref)
  }

  /**
   * Updates remote refs based on refspecs
   * Note: This is a simplified version. Full implementation would require GitRefSpecSet
   */
  static async updateRemoteRefs({
    fs,
    gitdir,
    remote,
    refs,
    symrefs,
    tags = false,
    refspecs,
    prune = false,
    pruneTags = false,
  }: {
    fs: FsClient
    gitdir: string
    remote: string
    refs: Map<string, string>
    symrefs: Map<string, string>
    tags?: boolean
    refspecs?: string[]
    prune?: boolean
    pruneTags?: boolean
  }): Promise<{ pruned: string[] }> {
    // Validate input
    for (const value of refs.values()) {
      if (!value.match(/[0-9a-f]{40}/)) {
        throw new InvalidOidError(value)
      }
    }

    // For now, use simple refspec translation: refs/heads/* -> refs/remotes/{remote}/*
    // Full implementation would use GitRefSpecSet
    const actualRefsToWrite = new Map<string, string>()

    // Handle tags
    if (tags) {
      for (const [serverRef, oid] of refs.entries()) {
        if (serverRef.startsWith('refs/tags/') && !serverRef.endsWith('^{}')) {
          // Only fetch tags that don't conflict
          if (!(await RefManager.exists({ fs, gitdir, ref: serverRef }))) {
            actualRefsToWrite.set(serverRef, oid)
          }
        }
      }
    }

    // Translate refs using simple refspec pattern
    for (const [serverRef, oid] of refs.entries()) {
      if (serverRef.startsWith('refs/heads/')) {
        const localRef = serverRef.replace('refs/heads/', `refs/remotes/${remote}/`)
        actualRefsToWrite.set(localRef, oid)
      } else if (serverRef === 'HEAD') {
        actualRefsToWrite.set(`refs/remotes/${remote}/HEAD`, oid)
      }
    }

    // Handle symrefs
    for (const [serverRef, target] of symrefs.entries()) {
      if (serverRef.startsWith('refs/heads/')) {
        const localRef = serverRef.replace('refs/heads/', `refs/remotes/${remote}/`)
        actualRefsToWrite.set(localRef, `ref: ${target}`)
      }
    }

    // Prune if requested
    const pruned: string[] = []
    if (prune) {
      const remoteRefsPath = `refs/remotes/${remote}`
      const existingRefs = await RefManager.listRefs({ fs, gitdir, filepath: remoteRefsPath })
      for (const ref of existingRefs) {
        const fullRef = `${remoteRefsPath}/${ref}`
        if (!actualRefsToWrite.has(fullRef)) {
          pruned.push(fullRef)
        }
      }
      if (pruned.length > 0) {
        await RefManager.deleteRefs({ fs, gitdir, refs: pruned })
      }
    }

    // Write all refs
    for (const [key, value] of actualRefsToWrite) {
      if (value.startsWith('ref: ')) {
        await RefManager.writeSymbolicRef({ fs, gitdir, ref: key, value: value.slice(5) })
      } else {
        await RefManager.writeRef({ fs, gitdir, ref: key, value })
      }
    }

    return { pruned }
  }
}

// Import serializePackedRefs for use in deleteRefs
import { serializePackedRefs } from './RefParser.js'
