import { NotFoundError } from "../errors/NotFoundError.ts"
import { dirname } from "../utils/dirname.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

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

