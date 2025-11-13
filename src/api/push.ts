import { _push } from "../commands/push.ts"
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
import type { ClientRef } from "../managers/GitRefManager.ts"
import type { RefUpdateStatus } from "../managers/GitRefManager.ts"

// ============================================================================
// PUSH TYPES
// ============================================================================

/**
 * Message callback for logging/status messages
 */
export type MessageCallback = (message: string) => void | Promise<void>

/**
 * Pre-push hook parameters
 */
export type PrePushParams = {
  remote: string // Expanded name of target remote
  url: string // URL address of target remote
  localRef: ClientRef // Ref which the client wants to push to the remote
  remoteRef: ClientRef // Ref which is known by the remote
}

/**
 * Pre-push callback
 */
export type PrePushCallback = (args: PrePushParams) => boolean | Promise<boolean>

/**
 * Push operation result
 */
export type PushResult = {
  ok: boolean
  refs: Record<string, RefUpdateStatus>
  headers?: Record<string, string>
}

/**
 * Push a branch or tag
 */
export async function push({
  fs,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  onPrePush,
  dir,
  gitdir = join(dir, '.git'),
  ref,
  remoteRef,
  remote = 'origin',
  url,
  force = false,
  delete: _delete = false,
  corsProxy,
  headers = {},
  cache = {},
}: {
  fs: FsClient
  http: HttpClient
  onProgress?: ProgressCallback
  onMessage?: MessageCallback
  onAuth?: AuthCallback
  onAuthSuccess?: AuthSuccessCallback
  onAuthFailure?: AuthFailureCallback
  onPrePush?: PrePushCallback
  dir?: string
  gitdir?: string
  ref?: string
  remoteRef?: string
  remote?: string
  url?: string
  force?: boolean
  delete?: boolean
  corsProxy?: string
  headers?: Record<string, string>
  cache?: Record<string, unknown>
}): Promise<PushResult> {
  try {
    assertParameter('fs', fs)
    assertParameter('http', http)
    assertParameter('gitdir', gitdir)

    return await _push({
      fs,
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      onPrePush,
      gitdir,
      ref,
      remoteRef,
      remote,
      url,
      force,
      delete: _delete,
      corsProxy,
      headers,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.push'
    throw err
  }
}

