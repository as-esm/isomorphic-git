import { GitWalkerIndex } from "../models/GitWalkerIndex.ts"
import { GitWalkSymbol } from "../utils/symbols.ts"
import type { Walker } from "../models/Walker.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * @returns {Walker}
 */
export function STAGE(): Walker {
  const o = Object.create(null)
  Object.defineProperty(o, GitWalkSymbol, {
    value: function ({ fs, gitdir, cache }: { fs: FsClient; gitdir: string; cache: Record<string, unknown> }) {
      return new GitWalkerIndex({ fs, gitdir, cache })
    },
  })
  Object.freeze(o)
  return o
}

