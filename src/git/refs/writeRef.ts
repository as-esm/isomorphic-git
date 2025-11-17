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

// Git's zero OID (null commit) - used for new refs and deletions
const ZERO_OID = '0000000000000000000000000000000000000000'

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
    // Read old OID before writing (for reflog)
    let oldOid = ZERO_OID // Default for new refs
    try {
      const { readRef } = await import('./readRef.ts')
      const oldValue = await readRef({ fs, gitdir, ref })
      if (oldValue && typeof oldValue === 'string' && /^[0-9a-f]{40}$/.test(oldValue)) {
        oldOid = oldValue
      }
    } catch {
      // Ref doesn't exist yet, use zero OID
    }
    
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
    
    // Log ref update to reflog (if enabled)
    if (oldOid !== trimmedValue) {
      const { logRefUpdate } = await import('../logs/logRefUpdate.ts')
      await logRefUpdate({
        fs,
        gitdir,
        ref,
        oldOid,
        newOid: trimmedValue,
        message: 'update by writeRef',
      }).catch(() => {
        // Silently ignore reflog errors (Git's behavior)
      })
    }
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
  oldOid: providedOldOid,
}: {
  fs: FsClient
  gitdir: string
  ref: string
  value: string
  oldOid?: string
}): Promise<void> {
  const normalizedFs = normalizeFs(fs)
  const path = join(gitdir, ref)
  
  // Read old HEAD OID BEFORE acquiring lock (for HEAD reflog)
  // Use provided oldOid if available (from checkout command), otherwise try to read it
  let oldOid: string | undefined = undefined
  let newOid = ZERO_OID
  
  if (ref === 'HEAD') {
    // If oldOid was provided and is valid, use it
    // CRITICAL: providedOldOid should be set by checkout command BEFORE any HEAD modifications
    // IMPORTANT: The checkout command reads oldOid before any HEAD modifications, so we should use it
    // Check if providedOldOid is a valid OID string first
    // IMPORTANT: We check for truthy value AND valid format
    // If providedOldOid is provided but is not a valid OID, we still don't try to read HEAD
    // because the checkout command already read it, and it might have been modified by now
    if (providedOldOid && typeof providedOldOid === 'string' && /^[0-9a-f]{40}$/.test(providedOldOid)) {
      // providedOldOid is a valid OID, use it
      oldOid = providedOldOid
    } else if (providedOldOid === undefined) {
      // providedOldOid was not provided at all, try to read it
      // Read old HEAD OID before writing (for HEAD reflog)
      // Use resolveRef which automatically handles symbolic refs
      // We read BEFORE acquiring the lock to avoid any lock-related issues
      // NOTE: This might fail if HEAD was already modified, so prefer providedOldOid
      try {
        const { resolveRef } = await import('./readRef.ts')
        // resolveRef automatically follows symbolic refs and returns the OID
        const oldHeadOid = await resolveRef({ fs, gitdir, ref: 'HEAD' })
        if (oldHeadOid && /^[0-9a-f]{40}$/.test(oldHeadOid)) {
          oldOid = oldHeadOid
        } else {
          // Resolved value is not a valid OID, leave as undefined
          oldOid = undefined
        }
      } catch (err) {
        // HEAD doesn't exist yet or can't be resolved - leave as undefined
        // This will be handled by logRefUpdate which will default to zero OID
        oldOid = undefined
      }
    }
    // If providedOldOid was provided but is not a valid OID, oldOid remains undefined
    // (will default to zero OID in logRefUpdate)
    
    // Resolve new HEAD OID (the target branch)
    try {
      const { resolveRef } = await import('./readRef.ts')
      const newHeadOid = await resolveRef({ fs, gitdir, ref: value })
      if (newHeadOid && /^[0-9a-f]{40}$/.test(newHeadOid)) {
        newOid = newHeadOid
      }
    } catch {
      // Target ref doesn't exist yet - will be resolved later
      // This shouldn't happen in normal operation, but we handle it gracefully
    }
  }
  
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
    
    // Log HEAD update to reflog (if enabled and HEAD changed)
    if (ref === 'HEAD') {
      // Use oldOid if available, otherwise use zero OID (for new refs)
      const finalOldOid = oldOid || ZERO_OID
      // Only log if oldOid and newOid are different (actual change occurred)
      if (finalOldOid !== newOid) {
        const { logRefUpdate } = await import('../logs/logRefUpdate.ts')
        await logRefUpdate({
          fs,
          gitdir,
          ref: 'HEAD',
          oldOid: finalOldOid,
          newOid,
          message: `checkout: moving from ${finalOldOid.slice(0, 7)} to ${trimmedValue}`,
        }).catch(() => {
          // Silently ignore reflog errors (Git's behavior)
        })
      }
    }
  })
}

