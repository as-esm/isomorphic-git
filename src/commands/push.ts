import { _currentBranch } from './currentBranch.ts'
import { _isDescendent } from './isDescendent.ts'
import { listCommitsAndTags } from './listCommitsAndTags.ts'
import { listObjects } from './listObjects.ts'
import { _pack } from './pack.ts'
import { GitPushError } from "../errors/GitPushError.ts"
import { MissingParameterError } from "../errors/MissingParameterError.ts"
import { NotFoundError } from "../errors/NotFoundError.ts"
import { PushRejectedError } from "../errors/PushRejectedError.ts"
import { UserCanceledError } from "../errors/UserCanceledError.ts"
import { ConfigAccess } from "../utils/configAccess.ts"
import { RefManager } from "../core-utils/refs/RefManager.ts"
import { findMergeBase } from "../core-utils/algorithms/CommitGraphWalker.ts"
import { GitRemoteManager } from "../managers/GitRemoteManager.ts"
import { GitSideBand } from "../models/GitSideBand.ts"
import { filterCapabilities } from "../utils/filterCapabilities.ts"
import { forAwait } from "../utils/forAwait.ts"
import { pkg } from "../utils/pkg.ts"
import { splitLines } from "../utils/splitLines.ts"
import { parseReceivePackResponse } from "../wire/parseReceivePackResponse.ts"
import { writeReceivePackRequest } from "../wire/writeReceivePackRequest.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type {
  HttpClient,
  ProgressCallback,
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
} from "../managers/GitRemoteHTTP.ts"
import type { MessageCallback, PrePushCallback, PushResult } from '../api/push.ts'

/**
 * Pushes commits to a remote repository
 */
export async function _push({
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
  ref: _ref,
  remoteRef: _remoteRef,
  remote,
  url: _url,
  force = false,
  delete: _delete = false,
  corsProxy,
  headers = {},
}: {
  fs: FsClient
  cache: Record<string, unknown>
  http: HttpClient
  onProgress?: ProgressCallback
  onMessage?: MessageCallback
  onAuth?: AuthCallback
  onAuthSuccess?: AuthSuccessCallback
  onAuthFailure?: AuthFailureCallback
  onPrePush?: PrePushCallback
  gitdir: string
  ref?: string
  remoteRef?: string
  remote?: string
  url?: string
  force?: boolean
  delete?: boolean
  corsProxy?: string
  headers?: Record<string, string>
}): Promise<PushResult> {
  const ref = _ref || (await _currentBranch({ fs, gitdir }))
  if (typeof ref === 'undefined') {
    throw new MissingParameterError('ref')
  }
  
  // Use ConfigAccess for config access
  const configService = new ConfigAccess(fs, gitdir)
  
  // Figure out what remote to use
  remote =
    remote ||
    ((await configService.getConfigValue(`branch.${ref}.pushRemote`)) as string) ||
    ((await configService.getConfigValue('remote.pushDefault')) as string) ||
    ((await configService.getConfigValue(`branch.${ref}.remote`)) as string) ||
    'origin'
  
  // Lookup the URL for the given remote
  const url =
    _url ||
    ((await configService.getConfigValue(`remote.${remote}.pushurl`)) as string) ||
    ((await configService.getConfigValue(`remote.${remote}.url`)) as string)
  if (typeof url === 'undefined') {
    throw new MissingParameterError('remote OR url')
  }
  
  // Figure out what remote ref to use
  const remoteRef = _remoteRef || ((await configService.getConfigValue(`branch.${ref}.merge`)) as string)
  if (typeof remoteRef === 'undefined') {
    throw new MissingParameterError('remoteRef')
  }

  if (corsProxy === undefined) {
    corsProxy = (await configService.getConfigValue('http.corsProxy')) as string | undefined
  }

  // Use RefManager for basic ref operations
  const fullRef = await RefManager.expand({ fs, gitdir, ref })
  const oid = _delete
    ? '0000000000000000000000000000000000000000'
    : await RefManager.resolve({ fs, gitdir, ref: fullRef })

  const GitRemoteHTTP = GitRemoteManager.getRemoteHelperFor({ url })
  const httpRemote = await GitRemoteHTTP.discover({
    http,
    onAuth,
    onAuthSuccess,
    onAuthFailure,
    corsProxy,
    service: 'git-receive-pack',
    url,
    headers,
    protocolVersion: 1,
  })
  const auth = httpRemote.auth
  let fullRemoteRef: string
  if (!remoteRef) {
    fullRemoteRef = fullRef
  } else {
    try {
      fullRemoteRef = RefManager.expandAgainstMap({
        ref: remoteRef,
        map: httpRemote.refs,
      })
    } catch (err) {
      if (err instanceof NotFoundError) {
        // The remote reference doesn't exist yet
        fullRemoteRef = remoteRef.startsWith('refs/') ? remoteRef : `refs/heads/${remoteRef}`
      } else {
        throw err
      }
    }
  }
  const oldoid =
    httpRemote.refs.get(fullRemoteRef) || '0000000000000000000000000000000000000000'

  if (onPrePush) {
    const hookCancel = await onPrePush({
      remote,
      url,
      localRef: { ref: _delete ? '(delete)' : fullRef, oid },
      remoteRef: { ref: fullRemoteRef, oid: oldoid },
    })
    if (!hookCancel) throw new UserCanceledError()
  }

  // Remotes can always accept thin-packs UNLESS they specify the 'no-thin' capability
  const thinPack = !httpRemote.capabilities.has('no-thin')

  let objects = new Set<string>()
  if (!_delete) {
    const finish = [...httpRemote.refs.values()]
    let skipObjects = new Set<string>()

    // If remote branch is present, look for a common merge base
    if (oldoid !== '0000000000000000000000000000000000000000') {
      // Use CommitGraphWalker.findMergeBase
      const mergebase = await findMergeBase({
        fs,
        cache,
        gitdir,
        commits: [oid, oldoid],
      })
      for (const oid of mergebase) finish.push(oid)
      if (thinPack) {
        skipObjects = await listObjects({ fs, cache, gitdir, oids: mergebase })
      }
    }

    // If remote does not have the commit, figure out the objects to send
    if (!finish.includes(oid)) {
      const commits = await listCommitsAndTags({
        fs,
        cache,
        gitdir,
        start: [oid],
        finish,
      })
      objects = await listObjects({ fs, cache, gitdir, oids: commits })
    }

    if (thinPack) {
      // If there's a default branch for the remote lets skip those objects too
      try {
        const ref = await RefManager.resolve({
          fs,
          gitdir,
          ref: `refs/remotes/${remote}/HEAD`,
          depth: 2,
        })
        const { oid } = RefManager.resolveAgainstMap({
          ref: ref.replace(`refs/remotes/${remote}/`, ''),
          fullref: ref,
          map: httpRemote.refs,
        })
        const oids = [oid]
        for (const oid of await listObjects({ fs, cache, gitdir, oids })) {
          skipObjects.add(oid)
        }
      } catch {
        // Ignore errors
      }

      // Remove objects that we know the remote already has
      for (const oid of skipObjects) {
        objects.delete(oid)
      }
    }

    if (oid === oldoid) force = true
    if (!force) {
      // Is it a tag that already exists?
      if (
        fullRef.startsWith('refs/tags') &&
        oldoid !== '0000000000000000000000000000000000000000'
      ) {
        throw new PushRejectedError('tag-exists')
      }
      // Is it a non-fast-forward commit?
      if (
        oid !== '0000000000000000000000000000000000000000' &&
        oldoid !== '0000000000000000000000000000000000000000' &&
        !(await _isDescendent({
          fs,
          cache,
          gitdir,
          oid,
          ancestor: oldoid,
          depth: -1,
        }))
      ) {
        throw new PushRejectedError('not-fast-forward')
      }
    }
  }
  
  // We can only safely use capabilities that the server also understands
  const capabilities = filterCapabilities(
    [...httpRemote.capabilities],
    ['report-status', 'side-band-64k', `agent=${pkg.agent}`]
  )
  
  const packstream1 = await writeReceivePackRequest({
    capabilities,
    triplets: [{ oldoid, oid, fullRef: fullRemoteRef }],
  })
  
  const packstream2 = _delete
    ? []
    : await _pack({
        fs,
        cache,
        gitdir,
        oids: [...objects],
      })
  
  const res = await GitRemoteHTTP.connect({
    http,
    onProgress,
    corsProxy,
    service: 'git-receive-pack',
    url,
    auth,
    headers,
    body: [...packstream1, ...packstream2],
  })
  
  const { packfile, progress } = await GitSideBand.demux(res.body)
  if (onMessage) {
    const lines = splitLines(progress)
    forAwait(lines, async line => {
      await onMessage(line)
    })
  }
  
  // Parse the response
  const result = await parseReceivePackResponse(packfile)
  if (res.headers) {
    result.headers = res.headers
  }

  // Update the local copy of the remote ref
  if (
    remote &&
    result.ok &&
    result.refs[fullRemoteRef].ok &&
    !fullRef.startsWith('refs/tags')
  ) {
    const ref = `refs/remotes/${remote}/${fullRemoteRef.replace('refs/heads', '')}`
    if (_delete) {
      await RefManager.deleteRef({ fs, gitdir, ref })
    } else {
      await RefManager.writeRef({ fs, gitdir, ref, value: oid })
    }
  }
  
  if (result.ok && Object.values(result.refs).every(result => result.ok)) {
    return result
  } else {
    const prettyDetails = Object.entries(result.refs)
      .filter(([k, v]) => !v.ok)
      .map(([k, v]) => `\n  - ${k}: ${v.error}`)
      .join('')
    throw new GitPushError(prettyDetails, result)
  }
}

