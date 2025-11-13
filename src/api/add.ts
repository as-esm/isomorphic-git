import { MultipleGitError } from "../errors/MultipleGitError.ts"
import { NotFoundError } from "../errors/NotFoundError.ts"
import { checkIgnored as checkIgnoredFile } from "../core-utils/filesystem/IgnoreManager.ts"
import { parse as parseIndex, serialize as serializeIndex, type IndexObject } from "../core-utils/index/Index.ts"
import { write as writeObject } from "../core-utils/odb/ObjectWriter.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { posixifyPathBuffer } from "../utils/posixifyPathBuffer.ts"
import { normalizeStats } from "../utils/normalizeStats.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Add a file to the git index (aka staging area)
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string|string[]} args.filepath - The path to the file to add to the index
 * @param {object} [args.cache] - a [cache](cache.md) object
 * @param {boolean} [args.force=false] - add to index even if matches gitignore. Think `git add --force`
 * @param {boolean} [args.parallel=false] - process each input file in parallel. Parallel processing will result in more memory consumption but less process time
 *
 * @returns {Promise<void>} Resolves successfully once the git index has been updated
 *
 * @example
 * await fs.promises.writeFile('/tutorial/README.md', `# TEST`)
 * await git.add({ fs, dir: '/tutorial', filepath: 'README.md' })
 * console.log('done')
 *
 */
export async function add({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  filepath,
  cache = {},
  force = false,
  parallel = true,
}: {
  fs: FsClient
  dir: string
  gitdir?: string
  filepath: string | string[]
  cache?: Record<string, unknown>
  force?: boolean
  parallel?: boolean
}): Promise<void> {
  try {
    assertParameter('fs', _fs)
    assertParameter('dir', dir)
    assertParameter('gitdir', gitdir)
    assertParameter('filepath', filepath)

    const fs = normalizeFs(_fs)
    
    // Read index
    let indexBuffer: Buffer<ArrayBuffer> = Buffer.alloc(0)
    try {
      const buffer = await fs.read(join(gitdir, 'index'))
      if (buffer && buffer !== null) {
        indexBuffer = (Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as string | Uint8Array)) as Buffer<ArrayBuffer>
      }
    } catch (err) {
      // Index doesn't exist yet
    }
    
    // Handle empty index - create a minimal index object with default version
    let index: IndexObject
    if (indexBuffer.length === 0) {
      // Empty index - create a minimal index object with default version
      index = {
        entries: new Map(),
        unmergedPaths: new Set(),
        version: 2, // Default index version
      }
    } else {
      index = await parseIndex(indexBuffer)
    }
    
    // Read config
    let configBuffer: Buffer<ArrayBuffer> = Buffer.alloc(0)
    try {
      const buffer = await fs.read(join(gitdir, 'config'))
      if (buffer && buffer !== null) {
        configBuffer = (Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as string | Uint8Array)) as Buffer<ArrayBuffer>
      }
    } catch (err) {
      // Config doesn't exist
    }
    const { ConfigAccess } = await import('../utils/configAccess.ts')
    const configAccess = new ConfigAccess(_fs, gitdir)
    const autocrlf = ((await configAccess.getConfigValue('core.autocrlf')) as string) || 'false'
    
    await addToIndex({
      dir,
      gitdir,
      fs,
      filepath,
      index,
      force,
      parallel,
      autocrlf,
    })
    
    // Write index back
    const updatedIndex = await serializeIndex(index)
    await fs.write(join(gitdir, 'index'), updatedIndex)
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.add'
    throw err
  }
}

async function addToIndex({
  dir,
  gitdir,
  fs,
  filepath,
  index,
  force,
  parallel,
  autocrlf,
}: {
  dir: string
  gitdir: string
  fs: ReturnType<typeof normalizeFs>
  filepath: string | string[]
  index: IndexObject
  force: boolean
  parallel: boolean
  autocrlf: string
}): Promise<void> {
  // TODO: Should ignore UNLESS it's already in the index.
  const filepaths = Array.isArray(filepath) ? filepath : [filepath]
  const promises = filepaths.map(async currentFilepath => {
    if (!force) {
      const ignored = await checkIgnoredFile({
        fs: fs as any,
        dir,
        gitdir,
        filepath: currentFilepath,
      })
      if (ignored) return
    }
    const stats = await fs.lstat(join(dir, currentFilepath))
    if (!stats) throw new NotFoundError(currentFilepath)

    if (stats.isDirectory()) {
      const children = await fs.readdir(join(dir, currentFilepath))
      if (!children) return
      if (parallel) {
        const promises = children.map(child =>
          addToIndex({
            dir,
            gitdir,
            fs,
            filepath: join(currentFilepath, child),
            index,
            force,
            parallel,
            autocrlf,
          })
        )
        await Promise.all(promises)
      } else {
        for (const child of children) {
          await addToIndex({
            dir,
            gitdir,
            fs,
            filepath: join(currentFilepath, child),
            index,
            force,
            parallel,
            autocrlf,
          })
        }
      }
    } else {
      const object = stats.isSymbolicLink()
        ? await fs.readlink(join(dir, currentFilepath)).then(posixifyPathBuffer)
        : await fs.read(join(dir, currentFilepath), { autocrlf })
      if (object === null || object === undefined) throw new NotFoundError(currentFilepath)
      
      // Write blob using ObjectWriter
      const oid = await writeObject({ fs: fs as any, gitdir, type: 'blob', object, format: 'content' })
      
      // Insert into index
      const normalizedStats = normalizeStats(stats)
      const entry = {
        path: currentFilepath,
        oid,
        mode: normalizedStats.mode || 0o100644,
        ctimeSeconds: normalizedStats.ctimeSeconds,
        ctimeNanoseconds: normalizedStats.ctimeNanoseconds,
        mtimeSeconds: normalizedStats.mtimeSeconds,
        mtimeNanoseconds: normalizedStats.mtimeNanoseconds,
        dev: normalizedStats.dev,
        ino: normalizedStats.ino,
        uid: normalizedStats.uid,
        gid: normalizedStats.gid,
        size: normalizedStats.size,
        flags: {
          assumeValid: false,
          extended: false,
          stage: 0,
          nameLength: Buffer.from(currentFilepath).length,
          skipWorktree: false,
          intentToAdd: false,
        },
        stages: [],
      }
      // Set stages array - for stage 0 entries, stages contains the entry itself
      const fullEntry = entry as any
      fullEntry.stages = [fullEntry]
      index.entries.set(currentFilepath, fullEntry)
    }
  })

  const settledPromises = await Promise.allSettled(promises)
  const rejectedPromises = settledPromises
    .filter((settle): settle is PromiseRejectedResult => settle.status === 'rejected')
    .map(settle => settle.reason)
  if (rejectedPromises.length > 1) {
    throw new MultipleGitError(rejectedPromises)
  }
  if (rejectedPromises.length === 1) {
    throw rejectedPromises[0]
  }

  // Return void as per the function signature
  return
}

