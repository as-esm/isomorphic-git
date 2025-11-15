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
import { join } from '../../core-utils/GitPath.ts'
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
    const parentDir = dirname(path)
    await normalizedFs.mkdir(parentDir, { recursive: true })
    
    // Write the ref file with the OID
    await normalizedFs.write(path, `${value.trim()}\n`, 'utf8')
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
    const parentDir = dirname(path)
    await normalizedFs.mkdir(parentDir, { recursive: true })
    
    // Write the symbolic ref with 'ref: ' prefix
    await normalizedFs.write(path, 'ref: ' + `${value.trim()}\n`, 'utf8')
  })
}

