/**
 * Reads a Git reference directly from .git/refs/ or .git/packed-refs
 * This is the single source of truth - reads directly from disk
 * 
 * @param fs - File system client
 * @param gitdir - Path to .git directory
 * @param ref - Reference name (e.g., 'HEAD', 'refs/heads/main', 'main')
 * @param depth - Maximum depth for symbolic ref resolution (default: 5)
 * @returns The resolved OID or null if ref doesn't exist
 */
import { NotFoundError } from '../../errors/NotFoundError.ts'
import { parsePackedRefs } from '../../core-utils/refs/RefParser.ts'
import { join } from '../../core-utils/GitPath.ts'
import { normalizeFs } from '../../utils/normalizeFs.ts'
import AsyncLock from 'async-lock'
import type { FsClient } from '../../models/FileSystem.ts'

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
 * Reads a Git reference and resolves it to an OID
 * Handles both direct refs and symbolic refs (like HEAD -> refs/heads/main)
 */
export async function readRef({
  fs,
  gitdir,
  ref,
  depth = 5,
}: {
  fs: FsClient
  gitdir: string
  ref: string
  depth?: number
}): Promise<string | null> {
  // Ensure ref is a string
  if (typeof ref !== 'string') {
    return null
  }
  
  if (depth <= 0) {
    // Max depth reached - return the ref as-is (might be a symbolic ref)
    // If it's a ref pointer, return just the target without 'ref: ' prefix
    if (ref.startsWith('ref: ')) {
      return ref.slice('ref: '.length).trim()
    }
    // If it's already a ref path (not an OID), return it
    if (!(/^[0-9a-f]{40}$/.test(ref))) {
      return ref
    }
    return null
  }

  // Is it a ref pointer?
  if (ref.startsWith('ref: ')) {
    const targetRef = ref.slice('ref: '.length).trim()
    // If depth is 1, return the target ref name instead of resolving further
    if (depth === 1) {
      return targetRef
    }
    return readRef({ fs, gitdir, ref: targetRef, depth: depth - 1 })
  }

  // Is it a complete and valid SHA?
  if (ref.length === 40 && /[0-9a-f]{40}/.test(ref)) {
    return ref
  }

  // Look in all the proper paths, in this order
  const allpaths = refpaths(ref).filter(p => !GIT_FILES.includes(p)) // exclude git system files
  console.log(`[DEBUG readRef] Attempting to resolve ref '${ref}', trying paths:`, allpaths)

  const normalizedFs = normalizeFs(fs)
  
  // CRITICAL: To synchronize with writeRef, we need to lock on the original ref name
  // when checking the first path (which equals the ref). For other paths, we use
  // path-specific locks. This prevents deadlocks while ensuring synchronization.
  // IMPORTANT: We read packed-refs INSIDE the lock for the first path to ensure
  // we see the latest state after any concurrent writes complete.
  for (const refPath of allpaths) {
    // Use the original ref name as lock key for the first path to sync with writeRef
    // For other paths, use the path itself as the lock key
    const lockKey = refPath === ref ? ref : refPath
    
    const sha = await acquireLock(lockKey, async () => {
      // Retry logic to handle race conditions with concurrent writes
      // If a write is in progress, the file might be temporarily unavailable
      const maxRetries = 3
      let lastError: unknown = null
      
      for (let retry = 0; retry < maxRetries; retry++) {
        try {
          // Read the ref file - try with 'utf8' encoding string first
          let content = await normalizedFs.read(join(gitdir, refPath), 'utf8')
          // If that returns null, try without encoding
          if (content === null || content === undefined) {
            content = await normalizedFs.read(join(gitdir, refPath))
          }
          if (content !== null && content !== undefined) {
            // Handle both string and Buffer returns
            let contentStr: string
            if (typeof content === 'string') {
              contentStr = content.trim()
            } else if (Buffer.isBuffer(content)) {
              contentStr = content.toString('utf8').trim()
            } else if (content instanceof Uint8Array) {
              contentStr = Buffer.from(content).toString('utf8').trim()
            } else {
              // Invalid content type, try packed refs
              break
            }
            
            // Validate that we got a valid ref value (not empty, not just whitespace)
            if (!contentStr || contentStr.length === 0) {
              // Empty file might mean write is in progress, retry
              if (retry < maxRetries - 1) {
                await new Promise(resolve => setImmediate(resolve))
                lastError = new Error('Empty ref file, retrying')
                continue
              }
              break
            }
            
            // Check if the content is a ref pointer (starts with 'ref: ')
            if (contentStr.startsWith('ref: ')) {
              const targetRef = contentStr.slice('ref: '.length).trim()
              // If depth is 1, return the target ref name instead of resolving further
              if (depth === 1) {
                return targetRef
              }
              // Recursively resolve the symbolic ref
              return readRef({ fs, gitdir, ref: contentStr, depth: depth - 1 })
            }
            // Otherwise return the SHA/content
            return contentStr || null
          }
        } catch (err) {
          // File doesn't exist or error reading
          lastError = err
          // If this is not the last retry, wait a bit and try again
          // This handles the case where writeRef is in the middle of writing
          if (retry < maxRetries - 1) {
            await new Promise(resolve => setImmediate(resolve))
            continue
          }
          // Last retry failed, break to try packed refs
          break
        }
      }
      
      // Try packed refs - read packed-refs INSIDE the lock to ensure we see latest state
      // This is critical for the first path (which equals the ref) to synchronize with writeRef
      const packedMap = await readPackedRefs({ fs, gitdir })
      const packedSha = packedMap.get(refPath)
      if (packedSha) {
        // If it's a symbolic ref and depth is 1, return the target ref name
        if (packedSha.startsWith('ref: ')) {
          const targetRef = packedSha.slice('ref: '.length).trim()
          if (depth === 1) {
            return targetRef
          }
        }
        // Recursively resolve - this handles both SHA and ref pointers
        return readRef({ fs, gitdir, ref: packedSha, depth: depth - 1 })
      }
      
      return null
    })
    
    if (sha) {
      return sha
    }
  }
  
  // Ref not found - return null (caller can throw NotFoundError if needed)
  return null
}

/**
 * Resolves a ref to its object ID, throwing NotFoundError if not found
 * This is a convenience wrapper around readRef that throws instead of returning null
 */
export async function resolveRef({
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
  const oid = await readRef({ fs, gitdir, ref, depth })
  if (oid === null) {
    throw new NotFoundError(ref)
  }
  return oid
}

/**
 * Reads a symbolic ref and returns its target without resolving to OID
 * Returns null if the ref is not symbolic or doesn't exist
 */
export async function readSymbolicRef({
  fs,
  gitdir,
  ref,
}: {
  fs: FsClient
  gitdir: string
  ref: string
}): Promise<string | null> {
  const normalizedFs = normalizeFs(fs)
  
  // Try reading the ref file directly
  try {
    let content = await normalizedFs.read(join(gitdir, ref), 'utf8')
    if (content === null || content === undefined) {
      content = await normalizedFs.read(join(gitdir, ref))
    }
    if (content !== null && content !== undefined) {
      let contentStr: string
      if (typeof content === 'string') {
        contentStr = content.trim()
      } else if (Buffer.isBuffer(content)) {
        contentStr = content.toString('utf8').trim()
      } else if (content instanceof Uint8Array) {
        contentStr = Buffer.from(content).toString('utf8').trim()
      } else {
        return null
      }
      
      // Check if it's a symbolic ref
      if (contentStr.startsWith('ref: ')) {
        return contentStr.slice('ref: '.length).trim()
      }
    }
  } catch {
    // File doesn't exist
  }
  
  // Try packed refs
  const packedMap = await readPackedRefs({ fs, gitdir })
  const allpaths = refpaths(ref).filter(p => !GIT_FILES.includes(p))
  
  for (const refPath of allpaths) {
    const packedValue = packedMap.get(refPath)
    if (packedValue && packedValue.startsWith('ref: ')) {
      return packedValue.slice('ref: '.length).trim()
    }
  }
  
  return null
}

/**
 * Reads the packed-refs file and returns a map of ref paths to OIDs
 */
async function readPackedRefs({
  fs,
  gitdir,
}: {
  fs: FsClient
  gitdir: string
}): Promise<Map<string, string>> {
  try {
    const normalizedFs = normalizeFs(fs)
    const packedRefsPath = join(gitdir, 'packed-refs')
    const content = await normalizedFs.read(packedRefsPath, 'utf8')
    if (typeof content === 'string') {
      return parsePackedRefs(content)
    }
  } catch {
    // packed-refs doesn't exist or can't be read - return empty map
  }
  return new Map()
}

