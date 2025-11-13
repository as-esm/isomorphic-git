import { GitWalkerRepo } from "../models/GitWalkerRepo.ts"
import { GitWalkSymbol } from "../utils/symbols.ts"
import type { Walker } from "../models/Walker.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * @param {object} args
 * @param {string} [args.ref='HEAD']
 * @returns {Walker}
 */
export function TREE({ ref = 'HEAD' }: { ref?: string } = {}): Walker {
  const o = Object.create(null)
  Object.defineProperty(o, GitWalkSymbol, {
    value: function ({ fs, gitdir, cache }: { fs: FsClient; gitdir: string; cache: Record<string, unknown> }) {
      return new GitWalkerRepo({ fs, gitdir, ref, cache })
    },
  })
  Object.freeze(o)
  return o
}

