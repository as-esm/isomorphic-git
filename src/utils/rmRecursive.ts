import { join } from './join.js'
import { normalizeFs } from './normalizeFs.js'
import type { FsClient } from '../models/FileSystem.js'

/**
 * Removes the directory at the specified filepath recursively. Used internally to replicate the behavior of
 * fs.promises.rm({ recursive: true, force: true }) from Node.js 14 and above when not available. If the provided
 * filepath resolves to a file, it will be removed.
 *
 * @param {import('../types.js').FsClient} fs
 * @param {string} filepath - The file or directory to remove.
 */
export async function rmRecursive(fs: FsClient, filepath: string): Promise<void> {
  const normalizedFs = normalizeFs(fs)
  const entries = await normalizedFs.readdir(filepath)
  if (entries == null) {
    await normalizedFs.rm(filepath)
  } else if (entries.length) {
    await Promise.all(
      entries.map(entry => {
        const subpath = join(filepath, entry)
        return normalizedFs.lstat(subpath).then(stat => {
          if (!stat) return
          return (stat as any).isDirectory() ? rmRecursive(fs, subpath) : normalizedFs.rm(subpath)
        })
      })
    ).then(() => normalizedFs.rmdir(filepath))
  } else {
    await normalizedFs.rmdir(filepath)
  }
}

