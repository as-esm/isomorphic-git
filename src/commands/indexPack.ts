import { GitPackIndex } from '../models/GitPackIndex.js'
import { _readObject as readObject } from '../storage/readObject.js'
import { join } from '../utils/join.js'
import type { FsClient } from '../models/FileSystem.js'
import type { ProgressCallback } from '../managers/GitRemoteHTTP.js'

/**
 * Index a pack file
 */
export async function _indexPack({
  fs,
  cache,
  onProgress,
  dir,
  gitdir,
  filepath,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  onProgress?: ProgressCallback
  dir: string
  gitdir: string
  filepath: string
}): Promise<{ oids: string[] }> {
  try {
    const fullPath = join(dir, filepath)
    const pack = await fs.read(fullPath)
    if (!pack) {
      throw new Error('Failed to read pack file')
    }
    const getExternalRefDelta = (oid: string) => readObject({ fs, cache, gitdir, oid })
    const idx = await GitPackIndex.fromPack({
      pack: pack as Uint8Array,
      getExternalRefDelta,
      onProgress,
    })
    await fs.write(fullPath.replace(/\.pack$/, '.idx'), await idx.toBuffer())
    return {
      oids: [...idx.hashes],
    }
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.indexPack'
    throw err
  }
}

