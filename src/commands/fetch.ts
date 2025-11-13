import { _currentBranch } from './currentBranch.ts'
import { MissingParameterError } from "../errors/MissingParameterError.ts"
import { RemoteCapabilityError } from "../errors/RemoteCapabilityError.ts"
import { ConfigAccess } from "../utils/configAccess.ts"
import { RefManager } from "../core-utils/refs/RefManager.ts"
import { ShallowManager } from "../core-utils/refs/ShallowManager.ts"
import { GitRemoteManager } from "../managers/GitRemoteManager.ts"
import { GitCommit } from "../models/GitCommit.ts"
import { GitPackIndex } from "../models/GitPackIndex.ts"
import { hasObject } from "../storage/hasObject.ts"
import { _readObject as readObject } from "../storage/readObject.ts"
import { abbreviateRef } from "../utils/abbreviateRef.ts"
import { collect } from "../utils/collect.ts"
import { emptyPackfile } from "../utils/emptyPackfile.ts"
import { filterCapabilities } from "../utils/filterCapabilities.ts"
import { forAwait } from "../utils/forAwait.ts"
import { join } from "../utils/join.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { pkg } from "../utils/pkg.ts"
import { splitLines } from "../utils/splitLines.ts"
import { parseUploadPackResponse } from "../wire/parseUploadPackResponse.ts"
import { writeUploadPackRequest } from "../wire/writeUploadPackRequest.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type {
  HttpClient,
  ProgressCallback,
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
} from "../managers/GitRemoteHTTP.ts"
import type { MessageCallback } from '../api/push.ts'
import type { FetchResult } from '../api/fetch.ts'

/**
 * Fetches commits from a remote repository
 */
export async function _fetch({
  fs,
  cache,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  gitdir,
  ref: _ref,
  remoteRef: _remoteRef,
  remote: _remote,
  url: _url,
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
}: {
  fs: FsClient
  cache: Record<string, unknown>
  http: HttpClient
  onProgress?: ProgressCallback
  onMessage?: MessageCallback
  onAuth?: AuthCallback
  onAuthSuccess?: AuthSuccessCallback
  onAuthFailure?: AuthFailureCallback
  gitdir: string
  ref?: string
  remoteRef?: string
  remote?: string
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
}): Promise<FetchResult> {
  const normalizedFs = normalizeFs(fs)
  const ref = _ref || (await _currentBranch({ fs, gitdir, test: true }))
  
      // Use ConfigAccess for config access
      const configService = new ConfigAccess(fs, gitdir)
  
  // Figure out what remote to use
  const remote = _remote || (ref && ((await configService.getConfigValue(`branch.${ref}.remote`)) as string)) || 'origin'
  
  // Lookup the URL for the given remote
  const url = _url || ((await configService.getConfigValue(`remote.${remote}.url`)) as string)
  if (typeof url === 'undefined') {
    throw new MissingParameterError('remote OR url')
  }
  
  // Figure out what remote ref to use
  const remoteRef =
    _remoteRef ||
    (ref && ((await configService.getConfigValue(`branch.${ref}.merge`)) as string)) ||
    _ref ||
    'HEAD'

  if (corsProxy === undefined) {
    corsProxy = (await configService.getConfigValue('http.corsProxy')) as string | undefined
  }

  const GitRemoteHTTP = GitRemoteManager.getRemoteHelperFor({ url })
  const remoteHTTP = await GitRemoteHTTP.discover({
    http,
    onAuth,
    onAuthSuccess,
    onAuthFailure,
    corsProxy,
    service: 'git-upload-pack',
    url,
    headers,
    protocolVersion: 1,
  })
  const auth = remoteHTTP.auth
  const remoteRefs = remoteHTTP.refs
  
  // For the special case of an empty repository with no refs, return null
  if (remoteRefs.size === 0) {
    return {
      defaultBranch: null,
      fetchHead: null,
      fetchHeadDescription: null,
    }
  }
  
  // Check that the remote supports the requested features
  if (depth !== null && !remoteHTTP.capabilities.has('shallow')) {
    throw new RemoteCapabilityError('shallow', 'depth')
  }
  if (since !== null && !remoteHTTP.capabilities.has('deepen-since')) {
    throw new RemoteCapabilityError('deepen-since', 'since')
  }
  if (exclude.length > 0 && !remoteHTTP.capabilities.has('deepen-not')) {
    throw new RemoteCapabilityError('deepen-not', 'exclude')
  }
  if (relative === true && !remoteHTTP.capabilities.has('deepen-relative')) {
    throw new RemoteCapabilityError('deepen-relative', 'relative')
  }
  
  const { oid, fullref } = RefManager.resolveAgainstMap({
    ref: remoteRef,
    map: remoteRefs,
  })
  
  // Filter out refs we want to ignore
  for (const remoteRef of remoteRefs.keys()) {
    if (
      remoteRef === fullref ||
      remoteRef === 'HEAD' ||
      remoteRef.startsWith('refs/heads/') ||
      (tags && remoteRef.startsWith('refs/tags/'))
    ) {
      continue
    }
    remoteRefs.delete(remoteRef)
  }
  
  // Assemble the application/x-git-upload-pack-request
  const capabilities = filterCapabilities(
    [...remoteHTTP.capabilities],
    [
      'multi_ack_detailed',
      'no-done',
      'side-band-64k',
      'ofs-delta',
      `agent=${pkg.agent}`,
    ]
  )
  if (relative) capabilities.push('deepen-relative')
  
  // Start figuring out which oids from the remote we want to request
  const wants = singleBranch ? [oid] : Array.from(remoteRefs.values())
  
  // Come up with a reasonable list of oids to tell the remote we already have
  const haveRefs = singleBranch
    ? ref ? [ref] : []
    : await RefManager.listRefs({
        fs,
        gitdir,
        filepath: 'refs',
      })
  
  let haves: string[] = []
  for (let ref of haveRefs) {
    try {
      ref = await RefManager.expand({ fs, gitdir, ref })
      const oid = await RefManager.resolve({ fs, gitdir, ref })
      if (await hasObject({ fs, cache, gitdir, oid })) {
        haves.push(oid)
      }
    } catch {
      // Ignore errors
    }
  }
  haves = [...new Set(haves)]
  
  const oids = await ShallowManager.read({ fs, gitdir })
  const shallows = remoteHTTP.capabilities.has('shallow') ? [...oids] : []
  
  const packstream = writeUploadPackRequest({
    capabilities,
    wants: wants as never[],
    haves: haves as never[],
    shallows: shallows as never[],
    depth: depth === null || depth === undefined ? undefined : null,
    since: since === null || since === undefined ? undefined : null,
    exclude: exclude as never[],
  })
  // CodeCommit will hang up if we don't send a Content-Length header
  const packbuffer = Buffer.from(await collect(packstream))
  const raw = await GitRemoteHTTP.connect({
    http,
    onProgress,
    corsProxy,
    service: 'git-upload-pack',
    url,
    auth,
    body: [packbuffer],
    headers,
  })
  
  const response = await parseUploadPackResponse(raw.body)
  if (raw.headers) {
    response.headers = raw.headers
  }
  
  // Apply all the 'shallow' and 'unshallow' commands
  for (const oid of response.shallows) {
    if (!oids.has(oid)) {
      try {
        const { object } = await readObject({ fs, cache, gitdir, oid })
        const commit = new GitCommit(object)
        const parents = commit.headers()?.parent
        let haveAllParents = false
        if (parents && parents.length > 0) {
          const hasParents = await Promise.all(
            parents.map(oid => hasObject({ fs, cache, gitdir, oid }))
          )
          haveAllParents = hasParents.every(has => has)
        } else {
          haveAllParents = true
        }
        if (!haveAllParents) {
          oids.add(oid)
        }
      } catch {
        oids.add(oid)
      }
    }
  }
  for (const oid of response.unshallows) {
    oids.delete(oid)
  }
  
  await ShallowManager.write({ fs, gitdir, oids })
  
  // Update local remote refs
  if (singleBranch) {
    const refs = new Map([[fullref, oid]])
    const symrefs = new Map()
    let bail = 10
    let key = fullref
    while (bail--) {
      const value = remoteHTTP.symrefs.get(key)
      if (value === undefined) break
      symrefs.set(key, value)
      key = value
    }
    const realRef = remoteRefs.get(key)
    if (realRef) {
      refs.set(key, realRef)
    }
    const { pruned } = await RefManager.updateRemoteRefs({
      fs,
      gitdir,
      remote,
      refs,
      symrefs,
      tags,
      prune,
    })
    if (prune) {
      response.pruned = pruned
    }
  } else {
    const { pruned } = await RefManager.updateRemoteRefs({
      fs,
      gitdir,
      remote,
      refs: remoteRefs,
      symrefs: remoteHTTP.symrefs,
      tags,
      prune,
      pruneTags,
    })
    if (prune) {
      response.pruned = pruned
    }
  }
  
  response.HEAD = remoteHTTP.symrefs.get('HEAD')
  if (response.HEAD === undefined) {
    const { oid } = RefManager.resolveAgainstMap({
      ref: 'HEAD',
      map: remoteRefs,
    })
    for (const [key, value] of remoteRefs.entries()) {
      if (key !== 'HEAD' && value === oid) {
        response.HEAD = key
        break
      }
    }
  }
  
  const noun = fullref.startsWith('refs/tags') ? 'tag' : 'branch'
  response.FETCH_HEAD = {
    oid,
    description: `${noun} '${abbreviateRef(fullref)}' of ${url}`,
  }

  if (onProgress || onMessage) {
    const lines = splitLines(response.progress)
    forAwait(lines, async line => {
      const msg = typeof line === 'string' ? line : String(line);
      if (onMessage) await onMessage(msg);
      if (onProgress) {
        const matches = msg.match(/([^:]*).*\((\d+?)\/(\d+?)\)/);
        if (matches) {
          await onProgress({
            phase: matches[1].trim(),
            loaded: parseInt(matches[2], 10),
            total: parseInt(matches[3], 10),
          })
        }
      }
    })
  }
  
  const packfile = Buffer.from(await collect(response.packfile))
  if (raw.body.error) throw raw.body.error
  const packfileSha = packfile.slice(-20).toString('hex')
  const res: FetchResult = {
    defaultBranch: response.HEAD || null,
    fetchHead: response.FETCH_HEAD.oid,
    fetchHeadDescription: response.FETCH_HEAD.description,
  }
  if (response.headers) {
    res.headers = response.headers
  }
  if (prune) {
    res.pruned = response.pruned
  }
  
  if (packfileSha !== '' && !emptyPackfile(packfile)) {
    res.packfile = `objects/pack/pack-${packfileSha}.pack`
    const fullpath = join(gitdir, res.packfile)
    await normalizedFs.write(fullpath, packfile)
    const getExternalRefDelta = (oid: string) => readObject({ fs, cache, gitdir, oid })
    const idx = await GitPackIndex.fromPack({
      pack: packfile,
      getExternalRefDelta,
      onProgress,
    })
    await normalizedFs.write(fullpath.replace(/\.pack$/, '.idx'), await idx.toBuffer())
  }
  
  return res
}

