import { GitIndexManager } from '../managers/GitIndexManager.js'
import { compareStrings } from '../utils/compareStrings.js'
import { flatFileListToDirectoryStructure } from '../utils/flatFileListToDirectoryStructure.js'
import { mode2type } from '../utils/mode2type.js'
import { normalizeStats } from '../utils/normalizeStats.js'
import type { FsClient, Stat } from './FileSystem.js'

type StageEntry = {
  _fullpath: string
  _type: false | 'tree' | 'blob' | 'special' | 'commit'
  _mode: false | number
  _stat: false | Stat | undefined
  _oid: false | string
}

type Inode = {
  type: 'tree' | 'blob' | 'special' | 'commit'
  fullpath: string
  metadata: {
    oid: string
    mode: number
    [key: string]: unknown
  }
  children?: Inode[]
}

export class GitWalkerIndex {
  fs: FsClient
  gitdir: string
  cache: Record<string, unknown>
  treePromise: Promise<Map<string, Inode>>
  ConstructEntry: new (fullpath: string) => StageEntry

  constructor({
    fs,
    gitdir,
    cache,
  }: {
    fs: FsClient
    gitdir: string
    cache: Record<string, unknown>
  }) {
    this.fs = fs
    this.gitdir = gitdir
    this.cache = cache
    this.treePromise = GitIndexManager.acquire(
      { fs, gitdir, cache },
      async function (index) {
        return flatFileListToDirectoryStructure(index.entries) as Map<string, Inode>
      }
    )
    const walker = this
    this.ConstructEntry = class StageEntry {
      _fullpath: string
      _type: false | 'tree' | 'blob' | 'special' | 'commit' = false
      _mode: false | number = false
      _stat: false | Stat | undefined = false
      _oid: false | string = false

      constructor(fullpath: string) {
        this._fullpath = fullpath
        this._type = false
        this._mode = false
        this._stat = false
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

      async content(): Promise<Uint8Array | void> {
        return walker.content(this)
      }

      async oid(): Promise<string> {
        return walker.oid(this)
      }
    } as new (fullpath: string) => StageEntry
  }

  async readdir(entry: StageEntry): Promise<string[] | null> {
    const filepath = entry._fullpath
    const tree = await this.treePromise
    const inode = tree.get(filepath)
    if (!inode) return null
    if (inode.type === 'blob') return null
    if (inode.type !== 'tree') {
      throw new Error(`ENOTDIR: not a directory, scandir '${filepath}'`)
    }
    const names = (inode.children || []).map(inode => inode.fullpath)
    names.sort(compareStrings)
    return names
  }

  async type(entry: StageEntry): Promise<'tree' | 'blob' | 'special' | 'commit'> {
    if (entry._type === false) {
      await this.stat(entry)
    }
    return entry._type as 'tree' | 'blob' | 'special' | 'commit'
  }

  async mode(entry: StageEntry): Promise<number> {
    if (entry._mode === false) {
      await this.stat(entry)
    }
    return entry._mode as number
  }

  async stat(entry: StageEntry): Promise<Stat | undefined> {
    if (entry._stat === false) {
      const tree = await this.treePromise
      const inode = tree.get(entry._fullpath)
      if (!inode) {
        throw new Error(
          `ENOENT: no such file or directory, lstat '${entry._fullpath}'`
        )
      }
      if (inode.type === 'tree') {
        entry._type = 'tree'
        entry._mode = 0o40000
        entry._stat = undefined
      } else {
        const stats = normalizeStats(inode.metadata)
        entry._type = mode2type(stats.mode)
        entry._mode = stats.mode
        entry._stat = stats
      }
    }
    return entry._stat
  }

  async content(_entry: StageEntry): Promise<Uint8Array | void> {
    // Cannot get content for an index entry
    return undefined
  }

  async oid(entry: StageEntry): Promise<string> {
    if (entry._oid === false) {
      const tree = await this.treePromise
      const inode = tree.get(entry._fullpath)
      if (!inode) {
        throw new Error(`ENOENT: no such file or directory, oid '${entry._fullpath}'`)
      }
      entry._oid = inode.metadata.oid
    }
    return entry._oid
  }
}

