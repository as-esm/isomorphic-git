// GitRefManager import removed - using src/git/refs/ functions instead
import { readSymbolicRef, resolveRef } from "../git/refs/readRef.ts"
import { abbreviateRef } from "../utils/abbreviateRef.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Get the current branch name
 */
export async function _currentBranch({
  fs,
  gitdir,
  fullname = false,
  test = false,
}: {
  fs: FsClient
  gitdir: string
  fullname?: boolean
  test?: boolean
}): Promise<string | undefined> {
  // First, try to read HEAD as a symbolic ref
  // This will return the target (e.g., 'refs/heads/master') if HEAD is symbolic
  let ref: string | null = await readSymbolicRef({ fs, gitdir, ref: 'HEAD' })
  
  // If HEAD is not symbolic (detached HEAD), try to resolve it to an OID
  // If it resolves to an OID, we're in detached HEAD state
  if (!ref) {
    try {
      const oid = await resolveRef({ fs, gitdir, ref: 'HEAD', depth: 1 })
      // If we got an OID, HEAD is detached - return undefined
      if (oid && /^[0-9a-f]{40}$/.test(oid)) {
        return undefined
      }
    } catch {
      // HEAD doesn't exist - return undefined (no branch)
      return undefined
    }
    return undefined
  }
  
  // If test is true, verify the ref actually exists
  if (test) {
    try {
      await resolveRef({ fs, gitdir, ref })
    } catch (_) {
      return undefined
    }
  }
  
  // Return `undefined` for detached HEAD (ref doesn't start with 'refs/')
  if (!ref.startsWith('refs/')) return undefined
  
  return fullname ? ref : abbreviateRef(ref)
}

