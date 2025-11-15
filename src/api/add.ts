import { MultipleGitError } from "../errors/MultipleGitError.ts"
import { NotFoundError } from "../errors/NotFoundError.ts"
import { checkIgnored as checkIgnoredFile } from "../core-utils/filesystem/IgnoreManager.ts"
import { write as writeObject } from "../core-utils/odb/ObjectWriter.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { posixifyPathBuffer } from "../utils/posixifyPathBuffer.ts"
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
    
    // CRITICAL: Pass gitdir to Repository.open() to ensure we get the same Repository instance
    // as other operations like status() and stash(). This ensures index state consistency.
    const { Repository } = await import('../core-utils/Repository.ts')
    const repo = await Repository.open({ fs: _fs, dir, gitdir, cache, autoDetectConfig: true })
    const worktree = repo.getWorktree()
    
    if (!worktree) {
      throw new Error('Cannot add files in bare repository')
    }
    
    const effectiveGitdir = await worktree.getGitdir()
    
    // Read config
    const { ConfigAccess } = await import('../utils/configAccess.ts')
    const configAccess = new ConfigAccess(_fs, effectiveGitdir)
    const autocrlf = ((await configAccess.getConfigValue('core.autocrlf')) as string) || 'false'
    
    // Read index directly from .git/index file (single source of truth)
    const index = await repo.readIndexDirect()
    
    // Check for unmerged paths
    if (index.unmergedPaths.size > 0) {
      const { UnmergedPathsError } = await import('../errors/UnmergedPathsError.ts')
      throw new UnmergedPathsError(Array.from(index.unmergedPaths))
    }
    
    // Modify index
    await addToIndex({
      dir,
      gitdir: effectiveGitdir,
      fs,
      filepath,
      index,
      force,
      parallel,
      autocrlf,
    })
    
    // Write index directly to .git/index file (single source of truth)
    await repo.writeIndexDirect(index)
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
  index: import('../git/index/GitIndex.ts').GitIndex
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
      
      // Insert into index using GitIndex.insert() method
      index.insert({
        filepath: currentFilepath,
        oid,
        stats,
        stage: 0,
      })
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

