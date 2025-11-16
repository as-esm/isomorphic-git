import { parseGitmodules, initSubmodule, updateSubmoduleUrl } from "../core-utils/filesystem/SubmoduleManager.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { Repository } from "../core-utils/Repository.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Submodule management API
 * Provides high-level operations for managing Git submodules
 */
export async function submodule({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  init,
  update,
  name,
  url,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  init?: boolean
  update?: boolean
  name?: string
  url?: string
  cache?: Record<string, unknown>
}): Promise<unknown> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    if (!dir) {
      throw new Error('dir is required for submodule operations')
    }

    const fs = normalizeFs(_fs)

    // CRITICAL: Use Repository to ensure state consistency
    const repo = await Repository.open({ fs: _fs, dir, gitdir, cache, autoDetectConfig: true })
    const effectiveGitdir = await repo.getGitdir()

    // List submodules
    if (!init && !update && !name) {
      const submodules = await parseGitmodules({ fs, dir })
      return Array.from(submodules.entries()).map(([name, info]) => ({
        name,
        ...info,
      }))
    }

    // Initialize submodule
    if (init) {
      if (!name) {
        throw new Error('name is required for submodule init')
      }
      await initSubmodule({ fs, dir, gitdir: effectiveGitdir, name })
      return { initialized: name }
    }

    // Update submodule
    if (update) {
      if (!name) {
        throw new Error('name is required for submodule update')
      }
      // Get the commit OID for the submodule from the parent tree
      // This would typically be done by reading the tree entry
      // For now, we'll just initialize it
      await initSubmodule({ fs, dir, gitdir: effectiveGitdir, name })
      // TODO: Actually clone and checkout the submodule
      return { updated: name }
    }

    // Update submodule URL
    if (url && name) {
      await updateSubmoduleUrl({ fs, dir, name, url })
      return { updated: name, url }
    }

    throw new Error('Invalid submodule operation: specify init, update, or provide name/url')
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.submodule'
    throw err
  }
}

