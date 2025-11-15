import { GitWalkerRepo } from "../models/GitWalkerRepo.ts"
import { GitWalkSymbol } from "../utils/symbols.ts"
import type { Walker } from "../models/Walker.ts"
import type { Repository } from "../core-utils/Repository.ts"

/**
 * @param {object} args
 * @param {string} [args.ref='HEAD']
 * @returns {Walker}
 */
export function TREE({ ref = 'HEAD' }: { ref?: string } = {}): Walker {
  const o = Object.create(null)
  Object.defineProperty(o, GitWalkSymbol, {
    value: async function ({ repo }: { repo: Repository }) {
      // Ensure gitdir is resolved
      const gitdir = await repo.getGitdir()
      return new GitWalkerRepo({ fs: repo.fs, gitdir, ref, cache: repo.cache })
    },
  })
  Object.freeze(o)
  return o
}

