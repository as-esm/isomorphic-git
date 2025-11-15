import { GitWalkerFs } from "../models/GitWalkerFs.ts"
import { GitWalkSymbol } from "../utils/symbols.ts"
import type { Walker } from "../models/Walker.ts"
import type { Repository } from "../core-utils/Repository.ts"

/**
 * @returns {Walker}
 */
export function WORKDIR(): Walker {
  const o = Object.create(null)
  Object.defineProperty(o, GitWalkSymbol, {
    value: async function ({ repo }: { repo: Repository }) {
      // Ensure gitdir is resolved
      const gitdir = await repo.getGitdir()
      const dir = repo.dir
      if (!dir) {
        throw new Error('Cannot create WORKDIR walker for bare repository')
      }
      return new GitWalkerFs({ repo })
    },
  })
  Object.freeze(o)
  return o
}

