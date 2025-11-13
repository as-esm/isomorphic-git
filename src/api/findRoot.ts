import { _findRoot } from '../commands/findRoot.js'
import { normalizeFs } from '../utils/normalizeFs.js'
import { assertParameter } from '../utils/assertParameter.js'
import type { FsClient } from '../models/FileSystem.js'

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
  fs,
  filepath,
}: {
  fs: FsClient
  filepath: string
}): Promise<string> {
  try {
    assertParameter('fs', fs)
    assertParameter('filepath', filepath)

    return await _findRoot({ fs: normalizeFs(fs) as any, filepath })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.findRoot'
    throw err
  }
}

