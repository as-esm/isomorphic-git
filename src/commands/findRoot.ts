import { NotFoundError } from '../errors/NotFoundError.js'
import { dirname } from '../utils/dirname.js'
import { join } from '../utils/join.js'
import type { FsClient } from '../models/FileSystem.js'

/**
 * Find the root git directory
 *
 * Starting at `filepath`, walks upward until it finds a directory that contains a subdirectory called '.git'.
 */
export const _findRoot = async ({
  fs,
  filepath,
}: {
  fs: FsClient
  filepath: string
}): Promise<string> => {
  if (await fs.exists(join(filepath, '.git'))) {
    return filepath
  } else {
    const parent = dirname(filepath)
    if (parent === filepath) {
      throw new NotFoundError(`git root for ${filepath}`)
    }
    return _findRoot({ fs, filepath: parent })
  }
}

