import { _fetch } from '../commands/fetch.js'
import { assertParameter } from '../utils/assertParameter.js'
import { join } from '../utils/join.js'
import type { FsClient } from '../models/FileSystem.js'
import type {
  HttpClient,
  ProgressCallback,
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
} from '../managers/GitRemoteHTTP.js'

// ============================================================================
// FETCH TYPES
// ============================================================================

/**
 * Message callback for logging/status messages
 */
export type MessageCallback = (message: string) => void | Promise<void>

/**
 * Fetch operation result
 */
export type FetchResult = {
  defaultBranch: string | null
  fetchHead: string | null
  fetchHeadDescription: string | null
  headers?: Record<string, string>
  pruned?: string[]
  packfile?: string
}

/**
 * Fetch commits from a remote repository
 */
export async function fetch({
  fs,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  ref,
  remote,
  remoteRef,
  url,
  corsProxy,
  depth = null,
  since = null,
  exclude = [],
  relative = false,
  tags = false,
  singleBranch = false,
  headers = {},
  prune = false,
  pruneTags = false,
  cache = {},
}: {
  fs: FsClient
  http: HttpClient
  onProgress?: ProgressCallback
  onMessage?: MessageCallback
  onAuth?: AuthCallback
  onAuthSuccess?: AuthSuccessCallback
  onAuthFailure?: AuthFailureCallback
  dir?: string
  gitdir?: string
  ref?: string
  remote?: string
  remoteRef?: string
  url?: string
  corsProxy?: string
  depth?: number | null
  since?: Date | null
  exclude?: string[]
  relative?: boolean
  tags?: boolean
  singleBranch?: boolean
  headers?: Record<string, string>
  prune?: boolean
  pruneTags?: boolean
  cache?: Record<string, unknown>
}): Promise<FetchResult> {
  try {
    assertParameter('fs', fs)
    assertParameter('http', http)
    if (!gitdir) {
      throw new Error('gitdir is required')
    }
    assertParameter('gitdir', gitdir)

    return await _fetch({
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
      remoteRef,
      url,
      corsProxy,
      depth,
      since,
      exclude,
      relative,
      tags,
      singleBranch,
      headers,
      prune,
      pruneTags,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.fetch'
    throw err
  }
}

