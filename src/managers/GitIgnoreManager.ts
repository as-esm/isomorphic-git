/**
 * @deprecated Use isIgnored from '../git/info/isIgnored.ts' instead
 * This class is kept for backward compatibility and will be removed in a future version.
 */
import { isIgnored as isIgnoredNew } from "../git/info/isIgnored.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * @deprecated Use isIgnored from '../git/info/isIgnored.ts' instead
 * I'm putting this in a Manager because I reckon it could benefit
 * from a LOT of caching.
 */
export class GitIgnoreManager {
  /**
   * @deprecated Use isIgnored from '../git/info/isIgnored.ts' instead
   * Determines whether a given file is ignored based on `.gitignore` rules and exclusion files.
   */
  static async isIgnored({
    fs,
    dir,
    gitdir = join(dir, '.git'),
    filepath,
  }: {
    fs: FsClient
    dir: string
    gitdir?: string
    filepath: string
  }): Promise<boolean> {
    // Delegate to the new implementation
    return await isIgnoredNew({ fs, dir, gitdir, filepath })
  }
}

