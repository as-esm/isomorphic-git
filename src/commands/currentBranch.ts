// GitRefManager import removed - using src/git/refs/ functions instead
import { resolveRef } from "../git/refs/readRef.ts"
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
  // Use direct resolveRef() for consistency
  // Handle the case where HEAD doesn't exist (fresh repo)
  let ref: string
  try {
    ref = await resolveRef({
      fs,
      gitdir,
      ref: 'HEAD',
      depth: 2,
    })
  } catch {
    // HEAD doesn't exist - return undefined (no branch)
    return undefined
  }
  if (test) {
    try {
      await resolveRef({ fs, gitdir, ref })
    } catch (_) {
      return undefined
    }
  }
  // Return `undefined` for detached HEAD
  if (!ref.startsWith('refs/')) return undefined
  return fullname ? ref : abbreviateRef(ref)
}

