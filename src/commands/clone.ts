import { _addRemote } from './addRemote.js'
import { _checkout } from './checkout.js'
import { _fetch } from './fetch.js'
import { _init } from './init.js'
import { ConfigAccess } from "../utils/configAccess.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type {
  HttpClient,
  ProgressCallback,
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
} from "../managers/GitRemoteHTTP.ts"
import type { MessageCallback } from '../api/push.ts'
import type { PostCheckoutCallback } from '../api/checkout.ts'

/**
 * Clones a repository from a remote URL
 */
export async function _clone({
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
  remote = 'origin',
  depth,
  since,
  exclude,
  relative,
  singleBranch = false,
  noCheckout = false,
  noTags = false,
  headers,
  nonBlocking = false,
  batchSize = 100,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  http: HttpClient
  onProgress?: ProgressCallback
  onMessage?: MessageCallback
  onAuth?: AuthCallback
  onAuthSuccess?: AuthSuccessCallback
  onAuthFailure?: AuthFailureCallback
  onPostCheckout?: PostCheckoutCallback
  dir?: string
  gitdir: string
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
  nonBlocking?: boolean
  batchSize?: number
}): Promise<void> {
  try {
    // Initialize repository
    await _init({ fs, gitdir })
    
    // Add remote
    await _addRemote({ fs, gitdir, remote, url, force: false })
    
    // Set corsProxy if provided
    if (corsProxy) {
      const configService = new ConfigAccess(fs, gitdir)
      await configService.setConfigValue('http.corsProxy', corsProxy, 'local')
    }
    
    // Fetch from remote
    const { defaultBranch, fetchHead } = await _fetch({
      fs,
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      gitdir,
      ref,
      remote,
      corsProxy,
      depth,
      since,
      exclude,
      relative,
      singleBranch,
      headers,
      tags: !noTags,
    })
    
    if (fetchHead === null) return
    
    // Determine which branch to checkout
    const branchToCheckout = ref || defaultBranch
    if (!branchToCheckout) return
    
    // Remove 'refs/heads/' prefix if present
    const branchName = branchToCheckout.replace('refs/heads/', '')
    
    // Checkout that branch
    await _checkout({
      fs,
      cache,
      onProgress,
      onPostCheckout,
      dir,
      gitdir,
      ref: branchName,
      remote,
      noCheckout,
      nonBlocking,
      batchSize,
    })
  } catch (err) {
    // Remove partial local repository on error
    // Ignore any error as we are already failing.
    // The catch is necessary so the original error is not masked.
    await fs.rmdir(gitdir, { recursive: true, maxRetries: 10 }).catch(() => undefined)
    throw err
  }
}

