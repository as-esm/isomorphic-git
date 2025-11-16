import { IgnoreManager } from "../core-utils/filesystem/IgnoreManager.ts"
import { WorkdirManager } from "../core-utils/filesystem/WorkdirManager.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { Repository } from "../core-utils/Repository.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Tell whether a file has been changed
 *
 * The possible resolve values are:
 *
 * | status                | description                                                                           |
 * | --------------------- | ------------------------------------------------------------------------------------- |
 * | `"ignored"`           | file ignored by a .gitignore rule                                                     |
 * | `"unmodified"`        | file unchanged from HEAD commit                                                       |
 * | `"*modified"`         | file has modifications, not yet staged                                                |
 * | `"*deleted"`          | file has been removed, but the removal is not yet staged                              |
 * | `"*added"`            | file is untracked, not yet staged                                                     |
 * | `"absent"`            | file not present in HEAD commit, staging area, or working dir                         |
 * | `"modified"`          | file has modifications, staged                                                        |
 * | `"deleted"`           | file has been removed, staged                                                         |
 * | `"added"`             | previously untracked file, staged                                                     |
 * | `"*unmodified"`       | working dir and HEAD commit match, but index differs                                  |
 * | `"*absent"`           | file not present in working dir or HEAD commit, but present in the index              |
 * | `"*undeleted"`        | file was deleted from the index, but is still in the working dir                      |
 * | `"*undeletemodified"` | file was deleted from the index, but is present with modifications in the working dir |
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.filepath - The path to the file to query
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<'ignored'|'unmodified'|'*modified'|'*deleted'|'*added'|'absent'|'modified'|'deleted'|'added'|'*unmodified'|'*absent'|'*undeleted'|'*undeletemodified'>} Resolves successfully with the file's git status
 *
 * @example
 * let status = await git.status({ fs, dir: '/tutorial', filepath: 'README.md' })
 * console.log(status)
 *
 */
export type FileStatus =
  | 'ignored'
  | 'unmodified'
  | '*modified'
  | '*deleted'
  | '*added'
  | 'absent'
  | 'modified'
  | 'deleted'
  | 'added'
  | '*unmodified'
  | '*absent'
  | '*undeleted'
  | '*undeletemodified'

export async function status({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  filepath,
  cache = {},
}: {
  fs: FsClient
  dir: string
  gitdir?: string
  filepath: string
  cache?: Record<string, unknown>
}): Promise<FileStatus> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('filepath', filepath)

    // CRITICAL: Get the Repository instance once and reuse it
    // This ensures getFileStatus uses the same Repository instance (and index state)
    // as other operations like add() and stash()
    // IMPORTANT: Pass gitdir to Repository.open() to ensure we get the same instance as add()
    const repo = await Repository.open({ fs: _fs, dir, gitdir, cache, autoDetectConfig: true })
    
    // Get worktree context for gitdir resolution
    let effectiveGitdir = gitdir
    try {
      const worktree = repo.getWorktree()
      if (worktree) {
        effectiveGitdir = await worktree.getGitdir()
      } else {
        effectiveGitdir = await repo.getGitdir()
      }
    } catch {
      // If getGitdir fails, use provided gitdir
      effectiveGitdir = gitdir
    }

    const fs = normalizeFs(_fs)

    // Check if ignored
    const ignored = await IgnoreManager.checkIgnored({
      fs,
      gitdir: effectiveGitdir,
      dir,
      filepath,
    })
    if (ignored) {
      return 'ignored'
    }

    // Use WorkdirManager to get status - pass the Repository object directly
    return await WorkdirManager.getFileStatus({
      repo,
      filepath,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.status'
    throw err
  }
}

