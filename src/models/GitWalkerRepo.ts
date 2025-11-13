import { NotFoundError } from '../errors/NotFoundError.js'
import { ObjectTypeError } from '../errors/ObjectTypeError.js'
import { GitRefManager } from '../managers/GitRefManager.js'
import { GitTree } from './GitTree.js'
import { _readObject as readObject } from '../storage/readObject.js'
import { join } from '../utils/join.js'
import { normalizeMode } from '../utils/normalizeMode.js'
import { resolveTree } from '../utils/resolveTree.js'
import type { FsClient, Stat } from './FileSystem.js'
import type { TreeEntry } from './GitTree.js'

type TreeEntryEntry = {
  _fullpath: string
  _type: false | 'tree' | 'blob' | 'special' | 'commit'
  _mode: false | number
  _stat: false | Stat | undefined
  _content: false | Uint8Array | undefined
  _oid: false | string
}

type MapEntry = {
  type: 'tree' | 'blob' | 'special' | 'commit'
  mode: string
  path: string
  oid: string
}

export class GitWalkerRepo {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  mapPromise: Promise<Map<string, MapEntry>>
  ConstructEntry: new (fullpath: string) => TreeEntryEntry

  constructor({
    fs,
    gitdir,
    ref,
    cache,
  }: {
    fs: FsClient
    gitdir: string
    ref: string
    cache: Record<string, unknown>
  }) {
    this.fs = fs
    this.cache = cache
    this.gitdir = gitdir
    this.mapPromise = (async () => {
      const map = new Map<string, MapEntry>()
      let oid: string
      try {
        oid = await GitRefManager.resolve({ fs, gitdir, ref })
      } catch (e) {
        if (e instanceof NotFoundError) {
          // Handle fresh branches with no commits
          oid = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
        } else {
          throw e
        }
      }
      const tree = await resolveTree({ fs, cache: this.cache, gitdir, oid })
      const mapEntry: MapEntry = {
        type: 'tree',
        mode: '40000',
        path: '.',
        oid: tree.oid,
      }
      map.set('.', mapEntry)
      return map
    })()
    const walker = this
    this.ConstructEntry = class TreeEntry {
      _fullpath: string
      _type: false | 'tree' | 'blob' | 'special' | 'commit' = false
      _mode: false | number = false
      _stat: false | Stat | undefined = false
      _content: false | Uint8Array | undefined = false
      _oid: false | string = false

      constructor(fullpath: string) {
        this._fullpath = fullpath
        this._type = false
        this._mode = false
        this._stat = false
        this._content = false
        this._oid = false
      }

      async type(): Promise<'tree' | 'blob' | 'special' | 'commit'> {
        return walker.type(this)
      }

      async mode(): Promise<number> {
        return walker.mode(this)
      }

      async stat(): Promise<Stat | undefined> {
        return walker.stat(this)
      }

      async content(): Promise<Uint8Array | undefined> {
        return walker.content(this)
      }

      async oid(): Promise<string> {
        return walker.oid(this)
      }
    } as new (fullpath: string) => TreeEntryEntry
  }

  async readdir(entry: TreeEntryEntry): Promise<string[] | null> {
    const filepath = entry._fullpath
    const { fs, cache, gitdir } = this
    const map = await this.mapPromise
    const obj = map.get(filepath)
    if (!obj) throw new Error(`No obj for ${filepath}`)
    const oid = obj.oid
    if (!oid) throw new Error(`No oid for obj ${JSON.stringify(obj)}`)
    if (obj.type !== 'tree') {
      // TODO: support submodules (type === 'commit')
      return null
    }
    const result: any = await readObject({ fs, cache, gitdir, oid })
    const type = result.type
    const object = result.object
    if (type !== obj.type) {
      throw new ObjectTypeError(oid, type, obj.type)
    }
    const tree = GitTree.from(object)
    // cache all entries
    for (const treeEntry of tree) {
      const mapEntry: MapEntry = {
        type: treeEntry.type as 'tree' | 'blob' | 'special' | 'commit',
        mode: treeEntry.mode,
        path: treeEntry.path,
        oid: treeEntry.oid,
      }
      map.set(join(filepath, treeEntry.path), mapEntry)
    }
    return tree.entries().map(entry => join(filepath, entry.path))
  }

  async type(entry: TreeEntryEntry): Promise<'tree' | 'blob' | 'special' | 'commit'> {
    if (entry._type === false) {
      const map = await this.mapPromise
      const obj = map.get(entry._fullpath)
      if (!obj) {
        throw new Error(`No obj for ${entry._fullpath}`)
      }
      entry._type = obj.type
    }
    return entry._type as 'tree' | 'blob' | 'special' | 'commit'
  }

  async mode(entry: TreeEntryEntry): Promise<number> {
    if (entry._mode === false) {
      const map = await this.mapPromise
      const obj = map.get(entry._fullpath)
      if (!obj) {
        throw new Error(`No obj for ${entry._fullpath}`)
      }
      entry._mode = normalizeMode(parseInt(obj.mode, 8))
    }
    return entry._mode
  }

  async stat(_entry: TreeEntryEntry): Promise<Stat | undefined> {
    return undefined
  }

  async content(entry: TreeEntryEntry): Promise<Uint8Array | undefined> {
    if (entry._content === false) {
      const map = await this.mapPromise
      const { fs, cache, gitdir } = this
      const obj = map.get(entry._fullpath)
      if (!obj) {
        throw new Error(`No obj for ${entry._fullpath}`)
      }
      const oid = obj.oid
      if (!oid) {
        throw new Error(`No oid for obj ${JSON.stringify(obj)}`)
      }
      const result: any = await readObject({ fs, cache, gitdir, oid })
      const type = result.type
      const object = result.object
      if (type !== 'blob') {
        entry._content = undefined
      } else {
        const objectBuffer = Buffer.isBuffer(object) ? object : Buffer.from(object as Uint8Array)
        entry._content = new Uint8Array(objectBuffer)
      }
    }
    return entry._content
  }

  async oid(entry: TreeEntryEntry): Promise<string> {
    if (entry._oid === false) {
      const map = await this.mapPromise
      const obj = map.get(entry._fullpath)
      if (!obj) {
        throw new Error(`No obj for ${entry._fullpath}`)
      }
      entry._oid = obj.oid
    }
    return entry._oid
  }
}

