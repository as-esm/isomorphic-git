// @ts-check
import '../typedefs.js'

import { GitWalkerIndex } from "../models/GitWalkerIndex.ts"
import { GitWalkSymbol } from "../utils/symbols.ts"

/**
 * @returns {Walker}
 */
export function STAGE() {
  const o = Object.create(null)
  Object.defineProperty(o, GitWalkSymbol, {
    value: function ({ fs, gitdir, cache }) {
      return new GitWalkerIndex({ fs, gitdir, cache })
    },
  })
  Object.freeze(o)
  return o
}
