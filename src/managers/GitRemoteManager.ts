/**
 * @deprecated Use getRemoteHelperFor from '../git/remote/getRemoteHelper.ts' instead
 * This class is kept for backward compatibility and will be removed in a future version.
 */
import { getRemoteHelperFor as getRemoteHelperForNew } from '../git/remote/getRemoteHelper.ts'
import { GitRemoteHTTP } from './GitRemoteHTTP.ts'

/**
 * @deprecated Use getRemoteHelperFor from '../git/remote/getRemoteHelper.ts' instead
 * A class for managing Git remotes and determining the appropriate remote helper for a given URL.
 */
export class GitRemoteManager {
  /**
   * @deprecated Use getRemoteHelperFor from '../git/remote/getRemoteHelper.ts' instead
   * Determines the appropriate remote helper for the given URL.
   */
  static getRemoteHelperFor({
    url,
  }: {
    url: string
  }): typeof GitRemoteHTTP {
    // Delegate to the new implementation
    return getRemoteHelperForNew({ url })
  }
}

