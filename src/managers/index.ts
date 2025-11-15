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

