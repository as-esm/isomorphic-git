import { GitRefManager } from '../managers/GitRefManager.js'
import { abbreviateRef } from '../utils/abbreviateRef.js'
import type { FsClient } from '../models/FileSystem.js'

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
  const ref = await GitRefManager.resolve({
    fs,
    gitdir,
    ref: 'HEAD',
    depth: 2,
  })
  if (test) {
    try {
      await GitRefManager.resolve({ fs, gitdir, ref })
    } catch (_) {
      return undefined
    }
  }
  // Return `undefined` for detached HEAD
  if (!ref.startsWith('refs/')) return undefined
  return fullname ? ref : abbreviateRef(ref)
}

