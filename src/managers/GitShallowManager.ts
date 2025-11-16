/**
 * @deprecated Use readShallow and writeShallow from '../git/shallow.ts' instead
 * This class is kept for backward compatibility and will be removed in a future version.
 */
import { readShallow, writeShallow } from "../git/shallow.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * @deprecated Use readShallow and writeShallow from '../git/shallow.ts' instead
 */
export class GitShallowManager {
  /**
   * @deprecated Use readShallow from '../git/shallow.ts' instead
   * Reads the `shallow` file in the Git repository and returns a set of object IDs (OIDs).
   */
  static async read({
    fs,
    gitdir,
  }: {
    fs: FsClient
    gitdir: string
  }): Promise<Set<string>> {
    // Delegate to the new implementation
    return await readShallow({ fs, gitdir })
  }

  /**
   * @deprecated Use writeShallow from '../git/shallow.ts' instead
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
    // Delegate to the new implementation
    return await writeShallow({ fs, gitdir, oids })
  }
}

