import { SubmoduleManager } from "../core-utils/filesystem/SubmoduleManager.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Submodule management API
 * Provides high-level operations for managing Git submodules
 */
export async function submodule({
  fs,
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
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir)
    if (!dir) {
      throw new Error('dir is required for submodule operations')
    }

    // List submodules
    if (!init && !update && !name) {
      const submodules = await SubmoduleManager.parseGitmodules({ fs, dir })
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
      await SubmoduleManager.initSubmodule({ fs, dir, gitdir, name })
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
      await SubmoduleManager.initSubmodule({ fs, dir, gitdir, name })
      // TODO: Actually clone and checkout the submodule
      return { updated: name }
    }

    // Update submodule URL
    if (url && name) {
      await SubmoduleManager.updateSubmoduleUrl({ fs, dir, name, url })
      return { updated: name, url }
    }

    throw new Error('Invalid submodule operation: specify init, update, or provide name/url')
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.submodule'
    throw err
  }
}

