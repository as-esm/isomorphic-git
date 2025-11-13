import { GitRefManager } from "../managers/GitRefManager.ts"
import { join } from "../utils/join.ts"
import { writeRefsAdResponse } from "../wire/writeRefsAdResponse.ts"
import type { FsClient } from "../models/FileSystem.ts"

export async function uploadPack({
  fs,
  dir,
  gitdir = join(dir, '.git'),
  advertiseRefs = false,
}: {
  fs: FsClient
  dir?: string
  gitdir?: string
  advertiseRefs?: boolean
}): Promise<Buffer | undefined> {
  try {
    if (advertiseRefs) {
      // Send a refs advertisement
      const capabilities = [
        'thin-pack',
        'side-band',
        'side-band-64k',
        'shallow',
        'deepen-since',
        'deepen-not',
        'allow-tip-sha1-in-want',
        'allow-reachable-sha1-in-want',
      ]
      let keys = await GitRefManager.listRefs({
        fs,
        gitdir,
        filepath: 'refs',
      })
      keys = keys.map(ref => `refs/${ref}`)
      const refs: Record<string, string> = {}
      keys.unshift('HEAD') // HEAD must be the first in the list
      for (const key of keys) {
        refs[key] = await GitRefManager.resolve({ fs, gitdir, ref: key })
      }
      const symrefs: Record<string, string> = {}
      symrefs.HEAD = await GitRefManager.resolve({
        fs,
        gitdir,
        ref: 'HEAD',
        depth: 2,
      })
      return writeRefsAdResponse({
        capabilities,
        refs,
        symrefs,
      })
    }
  } catch (err: any) {
    err.caller = 'git.uploadPack'
    throw err
  }
}

