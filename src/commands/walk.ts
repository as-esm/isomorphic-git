import { arrayRange } from "../utils/arrayRange.ts"
import { flat } from "../utils/flat.ts"
import { GitWalkSymbol } from "../utils/symbols.ts"
import { unionOfIterators } from "../utils/unionOfIterators.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { Repository } from "../core-utils/Repository.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { Walker, WalkerMap, WalkerReduce, WalkerIterate, WalkerEntry } from "../models/Walker.ts"

/**
 * @param {object} args
 * @param {Repository} args.repo - Repository instance (ensures state consistency)
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
  repo,
  trees,
  map = async (_: string, entry: WalkerEntry[]) => entry,
  // The default reducer is a flatmap that filters out undefineds.
  reduce = async (parent: unknown, children: unknown[]) => {
    // Ensure children is an array of arrays for flat()
    const childrenArray = Array.isArray(children) ? children : []
    const flatten = flat(childrenArray as unknown[][])
    if (parent !== undefined) flatten.unshift(parent)
    return flatten
  },
  // The default iterate function walks all children concurrently
  iterate = (walk: (root: string[]) => Promise<unknown>, children: IterableIterator<WalkerEntry[]>) => Promise.all([...children].map(walk)),
}: {
  repo: Repository
  trees: Walker[]
  map?: WalkerMap
  reduce?: WalkerReduce
  iterate?: WalkerIterate
}): Promise<unknown> {
  const walkers = await Promise.all(
    trees.map(proxy => proxy[GitWalkSymbol]({ repo }))
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

/**
 * A powerful recursive tree-walking utility.
 *
 * The `walk` API simplifies gathering detailed information about a tree or comparing all the filepaths in two or more trees.
 * Trees can be git commits, the working directory, or the or git index (staging area).
 * As long as a file or directory is present in at least one of the trees, it will be traversed.
 * Entries are traversed in alphabetical order.
 *
 * The arguments to `walk` are the `trees` you want to traverse, and 3 optional transform functions:
 *  `map`, `reduce`, and `iterate`.
 *
 * ## `TREE`, `WORKDIR`, and `STAGE`
 *
 * Tree walkers are represented by three separate functions that can be imported:
 *
 * ```js
 * import { TREE, WORKDIR, STAGE } from 'isomorphic-git'
 * ```
 *
 * These functions return opaque handles called `Walker`s.
 * The only thing that `Walker` objects are good for is passing into `walk`.
 * Here are the three `Walker`s passed into `walk` by the `statusMatrix` command for example:
 *
 * ```js
 * let ref = 'HEAD'
 *
 * let trees = [TREE({ ref }), WORKDIR(), STAGE()]
 * ```
 *
 * For the arguments, see the doc pages for [TREE](./TREE.md), [WORKDIR](./WORKDIR.md), and [STAGE](./STAGE.md).
 *
 * `map`, `reduce`, and `iterate` allow you control the recursive walk by pruning and transforming `WalkerEntry`s into the desired result.
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {Walker[]} args.trees - The trees you want to traverse
 * @param {WalkerMap} [args.map] - Transform `WalkerEntry`s into a result form
 * @param {WalkerReduce} [args.reduce] - Control how mapped entries are combined with their parent result
 * @param {WalkerIterate} [args.iterate] - Fine-tune how entries within a tree are iterated over
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<any>} The finished tree-walking result
 */
export async function walk({
  fs: _fs,
  dir,
  gitdir = join(dir, '.git'),
  trees,
  map,
  reduce,
  iterate,
  cache = {},
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  trees: Walker[]
  map?: WalkerMap
  reduce?: WalkerReduce
  iterate?: WalkerIterate
  cache?: Record<string, unknown>
}): Promise<any> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('trees', trees)

    const fs = normalizeFs(_fs)

    // CRITICAL: Get the Repository instance and pass it to _walk
    // This ensures all walkers use the same Repository instance
    const repo = await Repository.open({ fs: _fs, dir, gitdir, cache, autoDetectConfig: true })
    
    return await _walk({
      repo,
      trees,
      map,
      reduce,
      iterate,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.walk'
    throw err
  }
}

