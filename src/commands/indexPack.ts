import { GitPackIndex } from "../models/GitPackIndex.ts"
import { readObject } from "../git/objects/readObject.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { ProgressCallback } from "../managers/GitRemoteHTTP.ts"

/**
 * Create the .idx file for a given .pack file
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {ProgressCallback} [args.onProgress] - optional progress event callback
 * @param {string} args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.filepath - The path to the .pack file to index
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<{oids: string[]}>} Resolves with a list of the SHA-1 object ids contained in the packfile
 *
 * @example
 * let packfiles = await fs.promises.readdir('/tutorial/.git/objects/pack')
 * packfiles = packfiles.filter(name => name.endsWith('.pack'))
 * console.log('packfiles', packfiles)
 *
 * const { oids } = await git.indexPack({
 *   fs,
 *   dir: '/tutorial',
 *   filepath: `.git/objects/pack/${packfiles[0]}`,
 *   async onProgress (evt) {
 *     console.log(`${evt.phase}: ${evt.loaded} / ${evt.total}`)
 *   }
 * })
 * console.log(oids)
 *
 */
export async function indexPack({
  fs,
  onProgress,
  dir,
  gitdir = join(dir, '.git'),
  filepath,
  cache = {},
}: {
  fs: FsClient
  onProgress?: ProgressCallback
  dir: string
  gitdir?: string
  filepath: string
  cache?: Record<string, unknown>
}): Promise<{ oids: string[] }> {
  try {
    assertParameter('fs', fs)
    assertParameter('dir', dir)
    assertParameter('gitdir', gitdir)
    assertParameter('filepath', filepath)

    return await _indexPack({
      fs: normalizeFs(fs) as any,
      cache,
      onProgress,
      dir,
      gitdir,
      filepath,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.indexPack'
    throw err
  }
}

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

