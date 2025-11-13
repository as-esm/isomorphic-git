import { arrayRange } from "../utils/arrayRange.ts"
import { flat } from "../utils/flat.ts"
import { GitWalkSymbol } from "../utils/symbols.ts"
import { unionOfIterators } from "../utils/unionOfIterators.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { Walker, WalkerMap, WalkerReduce, WalkerIterate, WalkerEntry } from "../models/Walker.ts"

/**
 * @param {object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {object} args.cache
 * @param {string} [args.dir]
 * @param {string} [args.gitdir=join(dir,'.git')]
 * @param {Walker[]} args.trees
 * @param {WalkerMap} [args.map]
 * @param {WalkerReduce} [args.reduce]
 * @param {WalkerIterate} [args.iterate]
 *
 * @returns {Promise<any>} The finished tree-walking result
 *
 * @see {WalkerMap}
 *
 */
export async function _walk({
  fs,
  cache,
  dir,
  gitdir,
  trees,
  map = async (_: string, entry: WalkerEntry[]) => entry,
  // The default reducer is a flatmap that filters out undefineds.
  reduce = async (parent: unknown, children: unknown[]) => {
    const flatten = flat(children)
    if (parent !== undefined) flatten.unshift(parent)
    return flatten
  },
  // The default iterate function walks all children concurrently
  iterate = (walk: (root: string[]) => Promise<unknown>, children: IterableIterator<WalkerEntry[]>) => Promise.all([...children].map(walk)),
}: {
  fs: FsClient
  cache: Record<string, unknown>
  dir?: string
  gitdir?: string
  trees: Walker[]
  map?: WalkerMap
  reduce?: WalkerReduce
  iterate?: WalkerIterate
}): Promise<unknown> {
  const walkers = trees.map(proxy =>
    proxy[GitWalkSymbol]({ fs, dir, gitdir, cache })
  )

  const root = new Array(walkers.length).fill('.')
  const range = arrayRange(0, walkers.length)
  const unionWalkerFromReaddir = async (entries: unknown[]) => {
    range.forEach(i => {
      const entry = entries[i]
      entries[i] = entry && new (walkers[i] as any).ConstructEntry(entry)
    })
    const subdirs = await Promise.all(
      range.map(i => {
        const entry = entries[i]
        return entry ? (walkers[i] as any).readdir(entry) : []
      })
    )
    // Now process child directories
    const iterators = subdirs.map(array => {
      return (array === null ? [] : array)[Symbol.iterator]()
    })

    return {
      entries,
      children: unionOfIterators(iterators),
    }
  }

  const walk = async (root: string[]): Promise<unknown> => {
    const { entries, children } = await unionWalkerFromReaddir(root)
    const fullpath = (entries as any[]).find((entry: any) => entry && entry._fullpath)?._fullpath
    if (!fullpath) return undefined
    const parent = await map(fullpath, entries as WalkerEntry[])
    if (parent !== null) {
      let walkedChildren = await iterate(walk, children)
      walkedChildren = walkedChildren.filter(x => x !== undefined)
      return reduce(parent, walkedChildren)
    }
    return undefined
  }
  return walk(root)
}

