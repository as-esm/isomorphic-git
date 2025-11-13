import AsyncLock from 'async-lock'

import { join } from "../utils/join.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import type { FsClient } from "../models/FileSystem.ts"

let lock: AsyncLock | null = null

export class GitShallowManager {
  /**
   * Reads the `shallow` file in the Git repository and returns a set of object IDs (OIDs).
   */
  static async read({
    fs,
    gitdir,
  }: {
    fs: FsClient
    gitdir: string
  }): Promise<Set<string>> {
    if (lock === null) lock = new AsyncLock()
    const normalizedFs = normalizeFs(fs)
    const filepath = join(gitdir, 'shallow')
    const oids = new Set<string>()
    await lock.acquire(filepath, async function () {
      const text = await normalizedFs.read(filepath, { encoding: 'utf8' })
      if (text === null) return oids // no file
      if (typeof text === 'string' && text.trim() === '') return oids // empty file
      if (typeof text === 'string') {
        text
          .trim()
          .split('\n')
          .forEach(oid => oids.add(oid))
      }
    })
    return oids
  }

  /**
   * Writes a set of object IDs (OIDs) to the `shallow` file in the Git repository.
   * If the set is empty, the `shallow` file is removed.
   */
  static async write({
    fs,
    gitdir,
    oids,
  }: {
    fs: FsClient
    gitdir: string
    oids: Set<string>
  }): Promise<void> {
    if (lock === null) lock = new AsyncLock()
    const normalizedFs = normalizeFs(fs)
    const filepath = join(gitdir, 'shallow')
    if (oids.size > 0) {
      const text = [...oids].join('\n') + '\n'
      await lock.acquire(filepath, async function () {
        await normalizedFs.write(filepath, text, {
          encoding: 'utf8',
        })
      })
    } else {
      // No shallows
      await lock.acquire(filepath, async function () {
        await normalizedFs.rm(filepath)
      })
    }
  }
}

