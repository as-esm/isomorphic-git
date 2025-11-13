import { GitWalkerFs } from "../models/GitWalkerFs.ts"
import { GitWalkSymbol } from "../utils/symbols.ts"
import type { Walker } from "../models/Walker.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * @returns {Walker}
 */
export function WORKDIR(): Walker {
  const o = Object.create(null)
  Object.defineProperty(o, GitWalkSymbol, {
    value: function ({ fs, dir, gitdir, cache }: { fs: FsClient; dir?: string; gitdir: string; cache: Record<string, unknown> }) {
      return new GitWalkerFs({ fs, dir, gitdir, cache })
    },
  })
  Object.freeze(o)
  return o
}

