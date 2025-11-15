/**
 * Deletes Git references directly from .git/refs/ and .git/packed-refs
 * This is the single source of truth - deletes directly from disk
 * 
 * @param fs - File system client
 * @param gitdir - Path to .git directory
 * @param refs - Array of reference names to delete
 */
import { join } from '../../core-utils/GitPath.ts'
import { normalizeFs } from '../../utils/normalizeFs.ts'
import { parsePackedRefs, serializePackedRefs } from '../../core-utils/refs/RefParser.ts'
import AsyncLock from 'async-lock'
import type { FsClient } from '../../models/FileSystem.ts'

let lock: AsyncLock | undefined

const acquireLock = async <T>(ref: string, callback: () => Promise<T>): Promise<T> => {
  if (lock === undefined) lock = new AsyncLock()
  return lock.acquire(ref, callback)
}

/**
 * Deletes one or more refs from both loose refs and packed-refs
 */
export async function deleteRefs({
  fs,
  gitdir,
  refs,
}: {
  fs: FsClient
  gitdir: string
  refs: string[]
}): Promise<void> {
  const normalizedFs = normalizeFs(fs)
  
  // Delete regular refs
  await Promise.all(refs.map(ref => normalizedFs.rm(join(gitdir, ref)).catch(() => {
    // Ignore errors if ref doesn't exist
  })))

  // Delete any packed refs
  let text = await acquireLock('packed-refs', async () => {
    try {
      const content = await normalizedFs.read(join(gitdir, 'packed-refs'), 'utf8')
      return typeof content === 'string' ? content : ''
    } catch {
      return ''
    }
  })
  
  const packed = parsePackedRefs(text)
  const beforeSize = packed.size

  for (const ref of refs) {
    packed.delete(ref)
  }

  if (packed.size < beforeSize) {
    text = serializePackedRefs(packed).toString('utf8')
    await acquireLock('packed-refs', async () => {
      await normalizedFs.write(join(gitdir, 'packed-refs'), text, 'utf8')
    })
  }
}

/**
 * Deletes a single ref
 */
export async function deleteRef({
  fs,
  gitdir,
  ref,
}: {
  fs: FsClient
  gitdir: string
  ref: string
}): Promise<void> {
  return deleteRefs({ fs, gitdir, refs: [ref] })
}

