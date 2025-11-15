import { GitWalkerIndex } from "../models/GitWalkerIndex.ts"
import { GitWalkSymbol } from "../utils/symbols.ts"
import type { Walker } from "../models/Walker.ts"
import type { Repository } from "../core-utils/Repository.ts"

/**
 * @returns {Walker}
 */
export function STAGE(): Walker {
  const o = Object.create(null)
  Object.defineProperty(o, GitWalkSymbol, {
    value: async function ({ repo }: { repo: Repository }) {
      return new GitWalkerIndex({ repo })
    },
  })
  Object.freeze(o)
  return o
}

