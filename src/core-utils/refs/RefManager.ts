import { InvalidOidError } from "../../errors/InvalidOidError.ts"
import { NotFoundError } from "../../errors/NotFoundError.ts"
import { parsePackedRefs } from './RefParser.ts'
import { join } from '../GitPath.ts'
import { dirname } from '../../utils/dirname.ts'
import { normalizeFs } from '../../utils/normalizeFs.ts'
import AsyncLock from 'async-lock'
import type { FsClient } from "../../models/FileSystem.ts"

// Import new refs functions from src/git/refs/
import { readRef as readRefDirect, resolveRef as resolveRefDirect } from '../../git/refs/readRef.ts'
import { writeRef as writeRefDirect, writeSymbolicRef as writeSymbolicRefDirect } from '../../git/refs/writeRef.ts'
import { listRefs as listRefsDirect } from '../../git/refs/listRefs.ts'
import { deleteRef as deleteRefDirect, deleteRefs as deleteRefsDirect } from '../../git/refs/deleteRef.ts'

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
   * Delegates to src/git/refs/resolveRef() for direct file operations
   */
  static async resolve({
    fs,
    gitdir,
    ref,
    depth = 5,
  }: {
    fs: FsClient
    gitdir: string
    ref: string
    depth?: number
  }): Promise<string> {
    // Delegate to new resolveRef function
    return resolveRefDirect({ fs, gitdir, ref, depth })
  }

  /**
   * Lists all refs matching a given filepath prefix
   * Delegates to src/git/refs/listRefs() for direct file operations
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
    // Delegate to new listRefs function
    return listRefsDirect({ fs, gitdir, filepath })
  }

  /**
   * Writes a ref to the file system
   * Delegates to src/git/refs/writeRef() for direct file operations
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
    // Delegate to new writeRef function
    return writeRefDirect({ fs, gitdir, ref, value })
  }

  /**
   * Writes a symbolic ref to the file system
   * Delegates to src/git/refs/writeSymbolicRef() for direct file operations
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
    // Delegate to new writeSymbolicRef function
    return writeSymbolicRefDirect({ fs, gitdir, ref, value })
  }

  /**
   * Deletes a single ref
   * Delegates to src/git/refs/deleteRef() for direct file operations
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
    return deleteRefDirect({ fs, gitdir, ref })
  }

  /**
   * Deletes multiple refs
   * Delegates to src/git/refs/deleteRefs() for direct file operations
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
    return deleteRefsDirect({ fs, gitdir, refs })
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
import { serializePackedRefs } from './RefParser.ts'
