import { GitWalkSymbol } from "../utils/symbols.ts"
import type { FsClient, Stat } from './FileSystem.ts'

// ============================================================================
// WALKER TYPES
// ============================================================================

import type { Repository } from "../core-utils/Repository.ts"

/**
 * Walker - an opaque handle for tree traversal
 */
export type Walker = {
  [GitWalkSymbol]: (args: { repo: Repository }) => Promise<unknown>
}

/**
 * Walker entry interface for tree traversal
 */
export type WalkerEntry = {
  type: () => Promise<'tree' | 'blob' | 'special' | 'commit'>
  mode: () => Promise<number>
  oid: () => Promise<string>
  content: () => Promise<Uint8Array | void>
  stat: () => Promise<Stat>
}

/**
 * Walker map function type
 */
export type WalkerMap = (filename: string, entries: WalkerEntry[]) => Promise<unknown>

/**
 * Walker reduce function type
 */
export type WalkerReduce = (parent: unknown, children: unknown[]) => Promise<unknown>

/**
 * Walker iterate callback type
 */
export type WalkerIterateCallback = (entries: WalkerEntry[]) => Promise<unknown[]>

/**
 * Walker iterate function type
 */
export type WalkerIterate = (walk: WalkerIterateCallback, children: IterableIterator<WalkerEntry[]>) => Promise<unknown[]>

