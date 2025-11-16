/**
 * Writes a Git reference directly to .git/refs/
 * This is the single source of truth - writes directly to disk
 * 
 * @param fs - File system client
 * @param gitdir - Path to .git directory
 * @param ref - Reference name (e.g., 'refs/heads/main')
 * @param value - OID to write (for direct refs) or target ref (for symbolic refs)
 * @param symbolic - Whether this is a symbolic ref (default: false)
 */
import { join, normalize } from '../../core-utils/GitPath.ts'
import { dirname } from '../../utils/dirname.ts'
import { normalizeFs } from '../../utils/normalizeFs.ts'
import AsyncLock from 'async-lock'
import type { FsClient } from '../../models/FileSystem.ts'

let lock: AsyncLock | undefined

const acquireLock = async <T>(ref: string, callback: () => Promise<T>): Promise<T> => {
  if (lock === undefined) lock = new AsyncLock()
  return lock.acquire(ref, callback)
}

/**
 * Writes a direct ref (OID) to a ref file
 */
export async function writeRef({
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
  const path = join(gitdir, ref)
  
  await acquireLock(ref, async () => {
    // Ensure parent directory exists
    // FileSystem.mkdir already implements recursive directory creation
    const parentDir = dirname(path)
    await normalizedFs.mkdir(parentDir)
    
    // CRITICAL: Trim and validate OID to prevent concatenated OIDs
    // The value should be exactly 40 hex characters followed by a newline
    const trimmedValue = value.trim()
    
    // Strict validation: must be exactly 40 hex characters
    if (!/^[0-9a-f]{40}$/.test(trimmedValue)) {
      const { InvalidOidError } = await import('../../errors/InvalidOidError.ts')
      throw new InvalidOidError(
        `Invalid value for ref "${ref}": Not a 40-char OID. Got "${trimmedValue}" (length: ${trimmedValue.length})`
      )
    }
    
    // Write the ref file with ONLY the OID followed by a newline
    // This ensures we never write concatenated OIDs
    await normalizedFs.write(path, `${trimmedValue}\n`, 'utf8')
    
    // Record the mutation in StateMutationStream
    const { getStateMutationStream } = await import('../../core-utils/StateMutationStream.ts')
    const mutationStream = getStateMutationStream()
    const normalizedGitdir = normalize(gitdir)
    mutationStream.record({
      type: 'ref-write',
      gitdir: normalizedGitdir,
      data: { ref, value: trimmedValue },
    })
  })
}

/**
 * Writes a symbolic ref (e.g., HEAD -> refs/heads/main)
 */
export async function writeSymbolicRef({
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
  const path = join(gitdir, ref)
  
  await acquireLock(ref, async () => {
    // Ensure parent directory exists
    // FileSystem.mkdir already implements recursive directory creation
    const parentDir = dirname(path)
    await normalizedFs.mkdir(parentDir)
    
    // Write the symbolic ref with 'ref: ' prefix
    const trimmedValue = value.trim()
    await normalizedFs.write(path, 'ref: ' + `${trimmedValue}\n`, 'utf8')
    
    // Record the mutation in StateMutationStream
    const { getStateMutationStream } = await import('../../core-utils/StateMutationStream.ts')
    const mutationStream = getStateMutationStream()
    const normalizedGitdir = normalize(gitdir)
    mutationStream.record({
      type: 'ref-write',
      gitdir: normalizedGitdir,
      data: { ref, value: trimmedValue, symbolic: true },
    })
  })
}

