import { NotFoundError } from "../errors/NotFoundError.ts"
import { dirname } from "../utils/dirname.ts"
import { join } from "../utils/join.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Find the root git directory
 *
 * Starting at `filepath`, walks upward until it finds a directory that contains a subdirectory called '.git'.
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} args.filepath - The file directory to start searching in.
 *
 * @returns {Promise<string>} Resolves successfully with a root git directory path
 * @throws {NotFoundError}
 *
 * @example
 * let gitroot = await git.findRoot({
 *   fs,
 *   filepath: '/tutorial/src/utils'
 * })
 * console.log(gitroot)
 *
 */
export async function findRoot({
  fs: _fs,
  filepath,
}: {
  fs: FsClient
  filepath: string
}): Promise<string> {
  try {
    assertParameter('fs', _fs)
    assertParameter('filepath', filepath)

    const fs = normalizeFs(_fs)
    if (await fs.exists(join(filepath, '.git'))) {
      return filepath
    } else {
      const parent = dirname(filepath)
      if (parent === filepath) {
        throw new NotFoundError(`git root for ${filepath}`)
      }
      return findRoot({ fs, filepath: parent })
    }
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.findRoot'
    throw err
  }
}

