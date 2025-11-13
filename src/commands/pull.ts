import { _checkout } from "../commands/checkout.ts"
import { _currentBranch } from "../commands/currentBranch.ts"
import { _fetch } from "../commands/fetch.ts"
import { _merge } from "../commands/merge.ts"
import { MissingParameterError } from '../errors/MissingParameterError.ts'
import type { FsClient } from "../models/FileSystem.ts"
import type { HttpClient } from "../managers/GitRemoteHTTP.ts"
import type { ProgressCallback } from "../managers/GitRemoteHTTP.ts"
import type { MessageCallback } from "../api/fetch.ts"
import type { AuthCallback, AuthFailureCallback, AuthSuccessCallback } from "../managers/GitRemoteHTTP.ts"
import type { Author } from "../models/GitCommit.ts"

/**
 * @param {object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {object} args.cache
 * @param {HttpClient} args.http
 * @param {ProgressCallback} [args.onProgress]
 * @param {MessageCallback} [args.onMessage]
 * @param {AuthCallback} [args.onAuth]
 * @param {AuthFailureCallback} [args.onAuthFailure]
 * @param {AuthSuccessCallback} [args.onAuthSuccess]
 * @param {string} args.dir
 * @param {string} args.gitdir
 * @param {string} args.ref
 * @param {string} [args.url]
 * @param {string} [args.remote]
 * @param {string} [args.remoteRef]
 * @param {boolean} [args.prune]
 * @param {boolean} [args.pruneTags]
 * @param {string} [args.corsProxy]
 * @param {boolean} args.singleBranch
 * @param {boolean} args.fastForward
 * @param {boolean} args.fastForwardOnly
 * @param {Object<string, string>} [args.headers]
 * @param {Object} args.author
 * @param {string} args.author.name
 * @param {string} args.author.email
 * @param {number} args.author.timestamp
 * @param {number} args.author.timezoneOffset
 * @param {Object} args.committer
 * @param {string} args.committer.name
 * @param {string} args.committer.email
 * @param {number} args.committer.timestamp
 * @param {number} args.committer.timezoneOffset
 * @param {string} [args.signingKey]
 *
 * @returns {Promise<void>} Resolves successfully when pull operation completes
 *
 */
export async function _pull({
  fs,
  cache,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  dir,
  gitdir,
  ref,
  url,
  remote,
  remoteRef,
  prune,
  pruneTags,
  fastForward,
  fastForwardOnly,
  corsProxy,
  singleBranch,
  headers,
  author,
  committer,
  signingKey,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  http: HttpClient
  onProgress?: ProgressCallback
  onMessage?: MessageCallback
  onAuth?: AuthCallback
  onAuthSuccess?: AuthSuccessCallback
  onAuthFailure?: AuthFailureCallback
  dir?: string
  gitdir: string
  ref?: string
  url?: string
  remote?: string
  remoteRef?: string
  prune?: boolean
  pruneTags?: boolean
  corsProxy?: string
  singleBranch: boolean
  fastForward: boolean
  fastForwardOnly: boolean
  headers?: Record<string, string>
  author: Author
  committer: Author
  signingKey?: string
}): Promise<void> {
  try {
    // If ref is undefined, use 'HEAD'
    if (!ref) {
      const head = await _currentBranch({ fs, gitdir })
      // TODO: use a better error.
      if (!head) {
        throw new MissingParameterError('ref')
      }
      ref = head
    }

    const { fetchHead, fetchHeadDescription } = await _fetch({
      fs,
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      gitdir,
      corsProxy,
      ref,
      url,
      remote,
      remoteRef,
      singleBranch,
      headers,
      prune,
      pruneTags,
    })
    // Merge the remote tracking branch into the local one.
    await _merge({
      fs,
      cache,
      gitdir,
      ours: ref,
      theirs: fetchHead,
      fastForward,
      fastForwardOnly,
      message: `Merge ${fetchHeadDescription}`,
      author,
      committer,
      signingKey,
      dryRun: false,
      noUpdateBranch: false,
    })
    await _checkout({
      fs,
      cache,
      onProgress,
      dir,
      gitdir,
      ref,
      remote,
      noCheckout: false,
    })
  } catch (err: any) {
    err.caller = 'git.pull'
    throw err
  }
}

