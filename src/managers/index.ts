/**
 * @deprecated Manager classes are deprecated in favor of direct functions in src/git/
 * These exports are maintained for backward compatibility only.
 * 
 * Migration guide:
 * - GitConfigManager → use src/git/config.ts functions (getConfig, setConfig, etc.)
 * - GitIgnoreManager → use src/git/info/isIgnored.ts function
 * - GitRemoteManager → use src/git/remote/getRemoteHelper.ts function
 * - GitShallowManager → use src/git/shallow.ts functions
 * - GitStashManager → use src/git/refs/stash.ts functions
 * 
 * See CLEANUP_PLAN.md Phase 3/4 for details.
 */
export { GitConfigManager } from './GitConfigManager.ts'
export { GitIgnoreManager } from './GitIgnoreManager.ts'
export type { ServerRef, ClientRef, RefUpdateStatus } from '../git/refs/types.ts'
export { GitRemoteHTTP } from './GitRemoteHTTP.ts'
export type {
  GitProgressEvent,
  ProgressCallback,
  GitHttpRequest,
  GitHttpResponse,
  HttpFetch,
  HttpClient,
  GitAuth,
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
} from './GitRemoteHTTP.ts'
export { GitRemoteManager } from './GitRemoteManager.ts'
export { GitShallowManager } from './GitShallowManager.ts'
export { GitStashManager } from './GitStashManager.ts'

