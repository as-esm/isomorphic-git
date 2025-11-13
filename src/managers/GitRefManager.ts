// This is a convenience wrapper for reading and writing files in the 'refs' directory.
import AsyncLock from 'async-lock'

import { InvalidOidError } from '../errors/InvalidOidError.ts'
import { NoRefspecError } from '../errors/NoRefspecError.ts'
import { NotFoundError } from '../errors/NotFoundError.ts'
import { GitPackedRefs } from "../models/GitPackedRefs.ts"
import { GitRefSpecSet } from "../models/GitRefSpecSet.ts"
import { compareRefNames } from "../utils/compareRefNames.ts"
import { join } from "../utils/join.ts"
import { ConfigAccess } from "../utils/configAccess.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import type { FsClient } from "../models/FileSystem.ts"

// ============================================================================
// REF TYPES
// ============================================================================

/**
 * Server-side ref information
 */
export type ServerRef = {
  ref: string // Name of the ref
  oid: string // SHA-1 object id the ref points to
  target?: string // Target ref pointed to by a symbolic ref
  peeled?: string // If oid is an annotated tag, this is the SHA-1 it points to
}

/**
 * Client-side ref information
 */
export type ClientRef = {
  ref: string // Name of the ref
  oid: string // SHA-1 object id the ref points to
}

/**
 * Ref update status
 */
export type RefUpdateStatus = {
  ok: boolean
  error?: string // Optional error message if ok is false
}

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

async function acquireLock<T>(ref: string, callback: () => Promise<T> | T): Promise<T> {
  if (lock === undefined) lock = new AsyncLock()
  return lock.acquire(ref, callback)
}

/**
 * A class for managing Git references, including reading, writing, deleting, and resolving refs.
 */
export class GitRefManager {
  /**
   * Updates remote refs based on the provided refspecs and options.
   */
  static async updateRemoteRefs({
    fs,
    gitdir,
    remote,
    refs,
    symrefs,
    tags,
    refspecs = undefined,
    prune = false,
    pruneTags = false,
  }: {
    fs: FsClient
    gitdir: string
    remote: string
    refs: Map<string, string>
    symrefs: Map<string, string>
    tags: boolean
    refspecs?: string[]
    prune?: boolean
    pruneTags?: boolean
  }): Promise<{ pruned: string[] }> {
    const normalizedFs = normalizeFs(fs)
    // Validate input
    for (const value of refs.values()) {
      if (!value.match(/[0-9a-f]{40}/)) {
        throw new InvalidOidError(value)
      }
    }
    const configAccess = new ConfigAccess(fs, gitdir)
    let finalRefspecs = refspecs
    if (!finalRefspecs) {
      const allValues = await configAccess.getAllConfigValues(`remote.${remote}.fetch`)
      finalRefspecs = allValues.map(v => String(v.value))
      if (finalRefspecs.length === 0) {
        throw new NoRefspecError(remote)
      }
      // There's some interesting behavior with HEAD that doesn't follow the refspec.
      finalRefspecs.unshift(`+HEAD:refs/remotes/${remote}/HEAD`)
    }
    const refspec = GitRefSpecSet.from(finalRefspecs)
    const actualRefsToWrite = new Map<string, string>()
    // Delete all current tags if the pruneTags argument is true.
    if (pruneTags) {
      const tagList = await GitRefManager.listRefs({
        fs,
        gitdir,
        filepath: 'refs/tags',
      })
      await GitRefManager.deleteRefs({
        fs,
        gitdir,
        refs: tagList.map(tag => `refs/tags/${tag}`),
      })
    }
    // Add all tags if the fetch tags argument is true.
    if (tags) {
      for (const serverRef of refs.keys()) {
        if (serverRef.startsWith('refs/tags') && !serverRef.endsWith('^{}')) {
          // Git's behavior is to only fetch tags that do not conflict with tags already present.
          if (!(await GitRefManager.exists({ fs, gitdir, ref: serverRef }))) {
            // Always use the object id of the tag itself, and not the peeled object id.
            const oid = refs.get(serverRef)
            if (oid) {
              actualRefsToWrite.set(serverRef, oid)
            }
          }
        }
      }
    }
    // Combine refs and symrefs giving symrefs priority
    const refTranslations = refspec.translate([...refs.keys()])
    for (const [serverRef, translatedRef] of refTranslations) {
      const value = refs.get(serverRef)
      if (value) {
        actualRefsToWrite.set(translatedRef, value)
      }
    }
    const symrefTranslations = refspec.translate([...symrefs.keys()])
    for (const [serverRef, translatedRef] of symrefTranslations) {
      const value = symrefs.get(serverRef)
      if (value) {
        const symtarget = refspec.translateOne(value)
        if (symtarget) {
          actualRefsToWrite.set(translatedRef, `ref: ${symtarget}`)
        }
      }
    }
    // If `prune` argument is true, clear out the existing local refspec roots
    const pruned: string[] = []
    if (prune) {
      for (const filepath of refspec.localNamespaces()) {
        const refList = (
          await GitRefManager.listRefs({
            fs,
            gitdir,
            filepath,
          })
        ).map(file => `${filepath}/${file}`)
        for (const ref of refList) {
          if (!actualRefsToWrite.has(ref)) {
            pruned.push(ref)
          }
        }
      }
      if (pruned.length > 0) {
        await GitRefManager.deleteRefs({ fs, gitdir, refs: pruned })
      }
    }
    // Update files
    // TODO: For large repos with a history of thousands of pull requests
    // (i.e. gitlab-ce) it would be vastly more efficient to write them
    // to .git/packed-refs.
    // The trick is to make sure we a) don't write a packed ref that is
    // already shadowed by a loose ref and b) don't loose any refs already
    // in packed-refs. Doing this efficiently may be difficult. A
    // solution that might work is
    // a) load the current packed-refs file
    // b) add actualRefsToWrite, overriding the existing values if present
    // c) enumerate all the loose refs currently in .git/refs/remotes/${remote}
    // d) overwrite their value with the new value.
    // Examples of refs we need to avoid writing in loose format for efficieny's sake
    // are .git/refs/remotes/origin/refs/remotes/remote_mirror_3059
    // and .git/refs/remotes/origin/refs/merge-requests
    for (const [key, value] of actualRefsToWrite) {
      await acquireLock(key, async () =>
        normalizedFs.write(join(gitdir, key), `${value.trim()}\n`, 'utf8')
      )
    }
    return { pruned }
  }

  /**
   * Writes a ref to the file system.
   */
  // TODO: make this less crude?
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
    const normalizedFs = normalizeFs(fs)
    // Validate input
    if (!value.match(/[0-9a-f]{40}/)) {
      throw new InvalidOidError(value)
    }
    await acquireLock(ref, async () =>
      normalizedFs.write(join(gitdir, ref), `${value.trim()}\n`, 'utf8')
    )
  }

  /**
   * Writes a symbolic ref to the file system.
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
    const normalizedFs = normalizeFs(fs)
    await acquireLock(ref, async () =>
      normalizedFs.write(join(gitdir, ref), 'ref: ' + `${value.trim()}\n`, 'utf8')
    )
  }

  /**
   * Deletes a single ref.
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
    return GitRefManager.deleteRefs({ fs, gitdir, refs: [ref] })
  }

  /**
   * Deletes multiple refs.
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
    const normalizedFs = normalizeFs(fs)
    // Delete regular ref
    await Promise.all(refs.map(ref => normalizedFs.rm(join(gitdir, ref))))
    // Delete any packed ref
    const text = await acquireLock('packed-refs', async () =>
      normalizedFs.read(`${gitdir}/packed-refs`, { encoding: 'utf8' })
    )
    if (typeof text !== 'string') {
      return
    }
    const packed = GitPackedRefs.from(text)
    const beforeSize = packed.refs.size
    for (const ref of refs) {
      if (packed.refs.has(ref)) {
        packed.delete(ref)
      }
    }
    if (packed.refs.size < beforeSize) {
      const packedText = packed.toString()
      await acquireLock('packed-refs', async () =>
        normalizedFs.write(`${gitdir}/packed-refs`, packedText, { encoding: 'utf8' })
      )
    }
  }

  /**
   * Resolves a ref to its object ID.
   */
  static async resolve({
    fs,
    gitdir,
    ref,
    depth = undefined,
  }: {
    fs: FsClient
    gitdir: string
    ref: string
    depth?: number
  }): Promise<string> {
    let currentDepth = depth
    if (currentDepth !== undefined) {
      currentDepth--
      if (currentDepth === -1) {
        return ref
      }
    }

    // Is it a ref pointer?
    if (ref.startsWith('ref: ')) {
      const newRef = ref.slice('ref: '.length)
      return GitRefManager.resolve({ fs, gitdir, ref: newRef, depth: currentDepth })
    }
    // Is it a complete and valid SHA?
    if (ref.length === 40 && /[0-9a-f]{40}/.test(ref)) {
      return ref
    }
    // We need to alternate between the file system and the packed-refs
    const packedMap = await GitRefManager.packedRefs({ fs, gitdir })
    // Look in all the proper paths, in this order
    const allpaths = refpaths(ref).filter(p => !GIT_FILES.includes(p)) // exclude git system files (#709)

    const normalizedFs = normalizeFs(fs)
    for (const refPath of allpaths) {
      const sha = await acquireLock(
        refPath,
        async () => {
          const content = await normalizedFs.read(`${gitdir}/${refPath}`, { encoding: 'utf8' })
          if (typeof content === 'string') {
            return content
          }
          return packedMap.get(refPath)
        }
      )
      if (sha) {
        return GitRefManager.resolve({ fs, gitdir, ref: sha.trim(), depth: currentDepth })
      }
    }
    // Do we give up?
    throw new NotFoundError(ref)
  }

  /**
   * Checks if a ref exists.
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
      await GitRefManager.expand({ fs, gitdir, ref })
      return true
    } catch (err) {
      return false
    }
  }

  /**
   * Expands a ref to its full name.
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
    const packedMap = await GitRefManager.packedRefs({ fs, gitdir })
    const normalizedFs = normalizeFs(fs)
    // Look in all the proper paths, in this order
    const allpaths = refpaths(ref)
    for (const refPath of allpaths) {
      const refExists = await acquireLock(refPath, async () =>
        normalizedFs.exists(`${gitdir}/${refPath}`)
      )
      if (refExists) return refPath
      if (packedMap.has(refPath)) return refPath
    }
    // Do we give up?
    throw new NotFoundError(ref)
  }

  /**
   * Expands a ref against a provided map.
   */
  static async expandAgainstMap({
    ref,
    map,
  }: {
    ref: string
    map: Map<string, string>
  }): Promise<string> {
    // Look in all the proper paths, in this order
    const allpaths = refpaths(ref)
    for (const refPath of allpaths) {
      if (map.has(refPath)) return refPath
    }
    // Do we give up?
    throw new NotFoundError(ref)
  }

  /**
   * Resolves a ref against a provided map.
   */
  static resolveAgainstMap({
    ref,
    fullref = ref,
    depth = undefined,
    map,
  }: {
    ref: string
    fullref?: string
    depth?: number
    map: Map<string, string>
  }): { fullref: string; oid: string } {
    let currentDepth = depth
    if (currentDepth !== undefined) {
      currentDepth--
      if (currentDepth === -1) {
        return { fullref, oid: ref }
      }
    }
    // Is it a ref pointer?
    if (ref.startsWith('ref: ')) {
      const newRef = ref.slice('ref: '.length)
      return GitRefManager.resolveAgainstMap({ ref: newRef, fullref, depth: currentDepth, map })
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
        return GitRefManager.resolveAgainstMap({
          ref: sha.trim(),
          fullref: refPath,
          depth: currentDepth,
          map,
        })
      }
    }
    // Do we give up?
    throw new NotFoundError(ref)
  }

  /**
   * Reads the packed refs file and returns a map of refs.
   */
  static async packedRefs({
    fs,
    gitdir,
  }: {
    fs: FsClient
    gitdir: string
  }): Promise<Map<string, string>> {
    const normalizedFs = normalizeFs(fs)
    const text = await acquireLock('packed-refs', async () =>
      normalizedFs.read(`${gitdir}/packed-refs`, { encoding: 'utf8' })
    )
    if (typeof text !== 'string') {
      return new Map()
    }
    const packed = GitPackedRefs.from(text)
    return packed.refs
  }

  /**
   * Lists all refs matching a given filepath prefix.
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
    const normalizedFs = normalizeFs(fs)
    const packedMap = GitRefManager.packedRefs({ fs, gitdir })
    let files: string[] = []
    try {
      const dirFiles = await normalizedFs.readdirDeep(`${gitdir}/${filepath}`)
      files = dirFiles.map((x: string) => x.replace(`${gitdir}/${filepath}/`, ''))
    } catch (err) {
      files = []
    }

    const packed = await packedMap
    for (let key of packed.keys()) {
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
    // since we just appended things onto an array, we need to sort them now
    files.sort(compareRefNames)
    return files
  }

  /**
   * Lists all branches, optionally filtered by remote.
   */
  static async listBranches({
    fs,
    gitdir,
    remote,
  }: {
    fs: FsClient
    gitdir: string
    remote?: string
  }): Promise<string[]> {
    if (remote) {
      return GitRefManager.listRefs({
        fs,
        gitdir,
        filepath: `refs/remotes/${remote}`,
      })
    } else {
      return GitRefManager.listRefs({ fs, gitdir, filepath: `refs/heads` })
    }
  }

  /**
   * Lists all tags.
   */
  static async listTags({
    fs,
    gitdir,
  }: {
    fs: FsClient
    gitdir: string
  }): Promise<string[]> {
    const tags = await GitRefManager.listRefs({
      fs,
      gitdir,
      filepath: `refs/tags`,
    })
    return tags.filter(x => !x.endsWith('^{}'))
  }
}

