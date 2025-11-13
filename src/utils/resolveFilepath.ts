// @ts-check
import { InvalidFilepathError } from '../errors/InvalidFilepathError.js'
import { NotFoundError } from '../errors/NotFoundError.js'
import { ObjectTypeError } from '../errors/ObjectTypeError.js'
import { GitTree } from "../models/GitTree.ts"
import { _readObject as readObject } from "../storage/readObject.ts"
import { resolveTree } from './resolveTree.js'
import type { FsClient } from "../models/FileSystem.ts"

export async function resolveFilepath({
  fs,
  cache,
  gitdir,
  oid,
  filepath,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
  filepath: string
}): Promise<string> {
  // Ensure there are no leading or trailing directory separators.
  // I was going to do this automatically, but then found that the Git Terminal for Windows
  // auto-expands --filepath=/src/utils to --filepath=C:/Users/Will/AppData/Local/Programs/Git/src/utils
  // so I figured it would be wise to promote the behavior in the application layer not just the library layer.
  if (filepath.startsWith('/')) {
    throw new InvalidFilepathError('leading-slash')
  } else if (filepath.endsWith('/')) {
    throw new InvalidFilepathError('trailing-slash')
  }
  const _oid = oid
  const result = await resolveTree({ fs, cache, gitdir, oid })
  let tree = result.tree
  if (filepath === '') {
    oid = result.oid
  } else {
    const pathArray = filepath.split('/')
    oid = await _resolveFilepath({
      fs,
      cache,
      gitdir,
      tree,
      pathArray,
      oid: _oid,
      filepath,
    })
  }
  return oid
}

async function _resolveFilepath({
  fs,
  cache,
  gitdir,
  tree,
  pathArray,
  oid,
  filepath,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  tree: GitTree
  pathArray: string[]
  oid: string
  filepath: string
}): Promise<string> {
  const name = pathArray.shift()
  if (!name) {
    throw new NotFoundError(`file or directory found at "${oid}:${filepath}"`)
  }
  for (const entry of tree) {
    if (entry.path === name) {
      if (pathArray.length === 0) {
        return entry.oid
      } else {
        const { type, object } = await readObject({
          fs,
          cache,
          gitdir,
          oid: entry.oid,
        })
        if (type !== 'tree') {
          throw new ObjectTypeError(oid, (type || 'unknown') as 'commit' | 'blob' | 'tree' | 'tag', 'tree', filepath)
        }
        tree = GitTree.from(object)
        return _resolveFilepath({
          fs,
          cache,
          gitdir,
          tree,
          pathArray,
          oid,
          filepath,
        })
      }
    }
  }
  throw new NotFoundError(`file or directory found at "${oid}:${filepath}"`)
}

