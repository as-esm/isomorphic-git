import { ConfigAccess } from "../utils/configAccess.ts"
import { GitIndexManager } from "../managers/GitIndexManager.ts"
import { compareStats } from "../utils/compareStats.ts"
import { join } from "../utils/join.ts"
import { normalizeStats } from "../utils/normalizeStats.ts"
import { shasum } from "../utils/shasum.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import type { FsClient, Stat } from './FileSystem.js'
import type { WalkerEntry } from './Walker.js'

import { GitObject } from './GitObject.js'

type WorkdirEntry = {
  _fullpath: string
  _type: false | 'tree' | 'blob' | 'special'
  _mode: false | number
  _stat: false | Stat | undefined
  _content: false | Uint8Array | undefined
  _oid: false | string | undefined
  _actualSize?: number
}

export class GitWalkerFs {
  fs: FsClient
  cache: Record<string, unknown>
  dir: string
  gitdir: string
  configAccess: ConfigAccess | null = null
  ConstructEntry: new (fullpath: string) => WorkdirEntry

  constructor({
    fs,
    dir,
    gitdir,
    cache,
  }: {
    fs: FsClient
    dir: string
    gitdir: string
    cache: Record<string, unknown>
  }) {
    this.fs = fs
    this.cache = cache
    this.dir = dir
    this.gitdir = gitdir

    this.configAccess = null
    const walker = this
    this.ConstructEntry = class WorkdirEntry {
      _fullpath: string
      _type: false | 'tree' | 'blob' | 'special' = false
      _mode: false | number = false
      _stat: false | Stat | undefined = false
      _content: false | Uint8Array | undefined = false
      _oid: false | string | undefined = false
      _actualSize?: number

      constructor(fullpath: string) {
        this._fullpath = fullpath
        this._type = false
        this._mode = false
        this._stat = false
        this._content = false
        this._oid = false
      }

      async type(): Promise<'tree' | 'blob' | 'special'> {
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

      async oid(): Promise<string | undefined> {
        return walker.oid(this)
      }
    } as new (fullpath: string) => WorkdirEntry
  }

  async readdir(entry: WorkdirEntry): Promise<string[] | null> {
    const filepath = entry._fullpath
    const { fs, dir } = this
    const normalizedFs = normalizeFs(fs)
    const names = await normalizedFs.readdir(join(dir, filepath))
    if (names === null) return null
    return names.map(name => join(filepath, name))
  }

  async type(entry: WorkdirEntry): Promise<'tree' | 'blob' | 'special'> {
    if (entry._type === false) {
      await this.stat(entry)
    }
    return entry._type as 'tree' | 'blob' | 'special'
  }

  async mode(entry: WorkdirEntry): Promise<number> {
    if (entry._mode === false) {
      await this.stat(entry)
    }
    return entry._mode as number
  }

  async stat(entry: WorkdirEntry): Promise<Stat | undefined> {
    if (entry._stat === false) {
      const { fs, dir } = this
      const normalizedFs = normalizeFs(fs)
      let stat = await normalizedFs.lstat(`${dir}/${entry._fullpath}`)
      if (!stat) {
        throw new Error(
          `ENOENT: no such file or directory, lstat '${entry._fullpath}'`
        )
      }
      let type: 'tree' | 'blob' | 'special' = (stat as any).isDirectory() ? 'tree' : 'blob'
      if (type === 'blob' && !(stat as any).isFile() && !(stat as any).isSymbolicLink()) {
        type = 'special'
      }
      entry._type = type
      const normalizedStat = normalizeStats(stat)
      entry._mode = normalizedStat.mode
      // workaround for a BrowserFS edge case
      if (normalizedStat.size === -1 && entry._actualSize) {
        normalizedStat.size = entry._actualSize
      }
      entry._stat = normalizedStat
    }
    return entry._stat
  }

  async content(entry: WorkdirEntry): Promise<Uint8Array | undefined> {
    if (entry._content === false) {
      const { fs, dir, gitdir } = this
      const normalizedFs = normalizeFs(fs)
      if ((await this.type(entry)) === 'tree') {
        entry._content = undefined
      } else {
        const configAccess = await this._getConfigAccess(fs, gitdir)
        const autocrlf = (await configAccess.getConfigValue('core.autocrlf')) as string | undefined
        const content = await normalizedFs.read(`${dir}/${entry._fullpath}`, { autocrlf })
        if (content) {
          const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content as string | Uint8Array)
          // workaround for a BrowserFS edge case
          entry._actualSize = contentBuffer.length
          if (entry._stat && entry._stat.size === -1) {
            entry._stat.size = entry._actualSize
          }
          entry._content = new Uint8Array(contentBuffer)
        } else {
          entry._content = undefined
        }
      }
    }
    return entry._content
  }

  async oid(entry: WorkdirEntry): Promise<string | undefined> {
    if (entry._oid === false) {
      const self = this
      const { fs, gitdir, cache } = this
      let oid: string | undefined
      // See if we can use the SHA1 hash in the index.
      await GitIndexManager.acquire(
        { fs, gitdir, cache },
        async function (index) {
          const stage = index.entriesMap.get(entry._fullpath)
          const stats = await this.stat(entry)
          if (!stats) {
            oid = undefined
            return
          }
          const configAccess = await self._getConfigAccess(fs, gitdir)
          const filemode = (await configAccess.getConfigValue('core.filemode')) as boolean | undefined
          const trustino =
            typeof process !== 'undefined'
              ? !(process.platform === 'win32')
              : true
          if (!stage || compareStats(stats, stage, filemode, trustino)) {
            const content = await this.content(entry)
            if (content === undefined) {
              oid = undefined
            } else {
              oid = await shasum(
                GitObject.wrap({ type: 'blob', object: content })
              )
              // Update the stats in the index so we will get a "cache hit" next time
              // 1) if we can (because the oid and mode are the same)
              // 2) and only if we need to (because other stats differ)
              if (
                stage &&
                oid === stage.oid &&
                (!filemode || stats.mode === stage.mode) &&
                compareStats(stats, stage, filemode, trustino)
              ) {
                index.insert({
                  filepath: entry._fullpath,
                  stats,
                  oid,
                })
              }
            }
          } else {
            // Use the index SHA1 rather than compute it
            oid = stage.oid
          }
        }
      )
      entry._oid = oid
    }
    return entry._oid
  }

  async _getConfigAccess(fs: FsClient, gitdir: string): Promise<ConfigAccess> {
    if (!this.configAccess) {
      this.configAccess = new ConfigAccess(fs, gitdir)
    }
    return this.configAccess
  }
}

