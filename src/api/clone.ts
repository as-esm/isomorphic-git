import { _clone } from "../commands/clone.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type {
  HttpClient,
  ProgressCallback,
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
} from "../managers/GitRemoteHTTP.ts"
import type { MessageCallback } from './push.ts'
import type { PostCheckoutCallback } from './checkout.ts'

/**
 * Clone a repository
 */
export async function clone({
  fs,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  onPostCheckout,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  url,
  corsProxy,
  ref,
  remote = 'origin',
  depth,
  since,
  exclude = [],
  relative = false,
  singleBranch = false,
  noCheckout = false,
  noTags = false,
  headers = {},
  cache = {},
  nonBlocking = false,
  batchSize = 100,
}: {
  fs: FsClient
  http: HttpClient
  onProgress?: ProgressCallback
  onMessage?: MessageCallback
  onAuth?: AuthCallback
  onAuthSuccess?: AuthSuccessCallback
  onAuthFailure?: AuthFailureCallback
  onPostCheckout?: PostCheckoutCallback
  dir?: string
  gitdir?: string
  url: string
  corsProxy?: string
  ref?: string
  remote?: string
  depth?: number
  since?: Date
  exclude?: string[]
  relative?: boolean
  singleBranch?: boolean
  noCheckout?: boolean
  noTags?: boolean
  headers?: Record<string, string>
  cache?: Record<string, unknown>
  nonBlocking?: boolean
  batchSize?: number
}): Promise<void> {
  try {
    assertParameter('fs', fs)
    assertParameter('http', http)
    if (!gitdir) {
      throw new Error('gitdir is required')
    }
    assertParameter('gitdir', gitdir)
    if (!noCheckout) {
      assertParameter('dir', dir)
    }
    assertParameter('url', url)

    return await _clone({
      fs,
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      onPostCheckout,
      dir,
      gitdir,
      url,
      corsProxy,
      ref,
      remote,
      depth,
      since,
      exclude,
      relative,
      singleBranch,
      noCheckout,
      noTags,
      headers,
      nonBlocking,
      batchSize,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.clone'
    throw err
  }
}

