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
    return ref.startsWith('ref: ') ? ref : null
  }

  // Is it a ref pointer?
  if (ref.startsWith('ref: ')) {
    const targetRef = ref.slice('ref: '.length)
    return readRef({ fs, gitdir, ref: targetRef, depth: depth - 1 })
  }

  // Is it a complete and valid SHA?
  if (ref.length === 40 && /[0-9a-f]{40}/.test(ref)) {
    return ref
  }

  // We need to alternate between the file system and the packed-refs
  const packedMap = await readPackedRefs({ fs, gitdir })
  
  // Look in all the proper paths, in this order
  const allpaths = refpaths(ref).filter(p => !GIT_FILES.includes(p)) // exclude git system files

  const normalizedFs = normalizeFs(fs)
  for (const refPath of allpaths) {
    const sha = await acquireLock(refPath, async () => {
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
            return null
          }
          // Check if the content is a ref pointer (starts with 'ref: ')
          if (contentStr.startsWith('ref: ')) {
            // Recursively resolve the symbolic ref
            return readRef({ fs, gitdir, ref: contentStr, depth: depth - 1 })
          }
          // Otherwise return the SHA/content
          return contentStr || null
        }
      } catch {
        // File doesn't exist or error reading, try packed refs
      }
      
      // Try packed refs
      const packedSha = packedMap.get(refPath)
      if (packedSha) {
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

