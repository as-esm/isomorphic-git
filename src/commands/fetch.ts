import { _currentBranch } from './currentBranch.ts'
import { MissingParameterError } from "../errors/MissingParameterError.ts"
import { RemoteCapabilityError } from "../errors/RemoteCapabilityError.ts"
import { ConfigAccess } from "../utils/configAccess.ts"
import { RefManager } from "../core-utils/refs/RefManager.ts"
import { readShallow, writeShallow } from "../git/shallow.ts"
import { getRemoteHelperFor } from "../git/remote/getRemoteHelper.ts"
import { GitCommit } from "../models/GitCommit.ts"
import { GitPackIndex } from "../models/GitPackIndex.ts"
import { hasObject } from "../git/objects/hasObject.ts"
import { readObject } from "../git/objects/readObject.ts"
import { abbreviateRef } from "../utils/abbreviateRef.ts"
import { collect } from "../utils/collect.ts"
import { emptyPackfile } from "../utils/emptyPackfile.ts"
import { filterCapabilities } from "../utils/filterCapabilities.ts"
import { forAwait } from "../utils/forAwait.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { pkg } from "../utils/pkg.ts"
import { splitLines } from "../utils/splitLines.ts"
import { parseUploadPackResponse } from "../wire/parseUploadPackResponse.ts"
import { writeUploadPackRequest } from "../wire/writeUploadPackRequest.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type {
  HttpClient,
  ProgressCallback,
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
} from "../git/remote/GitRemoteHTTP.ts"

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
  fs: _fs,
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
    assertParameter('fs', _fs)
    assertParameter('http', http)
    if (!gitdir) {
      throw new Error('gitdir is required')
    }
    assertParameter('gitdir', gitdir)

    const fs = normalizeFs(_fs)
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

/**
 * Internal fetch implementation
 * @internal - Exported for use by other commands (e.g., clone)
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
  protocolVersion = 1,
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
  protocolVersion?: 1 | 2
}): Promise<FetchResult> {
  const normalizedFs = normalizeFs(fs)
  const ref = _ref || (await _currentBranch({ fs, gitdir, test: true }))
  
  // CRITICAL: Use Repository to ensure consistent config access
  const { Repository } = await import('../core-utils/Repository.ts')
  const repo = await Repository.open({ fs, dir: undefined, gitdir, cache, autoDetectConfig: true })
  const configService = await repo.getConfig()
  
  // Figure out what remote to use
  const remote = _remote || (ref && ((await configService.get(`branch.${ref}.remote`)) as string)) || 'origin'
  
  // Lookup the URL for the given remote
  const url = _url || ((await configService.get(`remote.${remote}.url`)) as string)
  if (typeof url === 'undefined') {
    throw new MissingParameterError('remote OR url')
  }
  
  // Figure out what remote ref to use
  const remoteRef =
    _remoteRef ||
    (ref && ((await configService.get(`branch.${ref}.merge`)) as string)) ||
    _ref ||
    'HEAD'

  if (corsProxy === undefined) {
    corsProxy = (await configService.get('http.corsProxy')) as string | undefined
  }

  const GitRemoteHTTP = getRemoteHelperFor({ url })
  console.log(`[Git Protocol] Starting fetch operation, requesting protocol version ${protocolVersion}`)
  const remoteHTTP = await GitRemoteHTTP.discover({
    http,
    onAuth,
    onAuthSuccess,
    onAuthFailure,
    corsProxy,
    service: 'git-upload-pack',
    url,
    headers,
    protocolVersion,
  })
  
  const auth = remoteHTTP.auth
  
  // Handle protocol v2: fetch refs separately using ls-refs command
  let remoteRefs: Map<string, string>
  let symrefs: Map<string, string>
  
  if (remoteHTTP.protocolVersion === 2) {
    console.log(`[Git Protocol] Server responded with v2, fetching refs separately using ls-refs command`)
    
    // Protocol v2 requires separate ls-refs command to get refs
    const { writeListRefsRequest } = await import('../wire/writeListRefsRequest.ts')
    const { parseListRefsResponse } = await import('../wire/parseListRefsResponse.ts')
    
    const body = await writeListRefsRequest({ symrefs: true })
    const connectRes = await GitRemoteHTTP.connect({
      http,
      auth,
      headers,
      corsProxy,
      service: 'git-upload-pack',
      url,
      body,
    })
    
    if (!connectRes.body) {
      throw new Error('No response body from ls-refs command')
    }
    
    const serverRefs = await parseListRefsResponse(connectRes.body)
    remoteRefs = new Map<string, string>()
    symrefs = new Map<string, string>()
    
    for (const serverRef of serverRefs) {
      remoteRefs.set(serverRef.ref, serverRef.oid)
      if (serverRef.target) {
        symrefs.set(serverRef.ref, serverRef.target)
      }
    }
    
    console.log(`[Git Protocol] Fetched ${remoteRefs.size} refs via protocol v2 ls-refs command`)
  } else {
    // Protocol v1: refs are in the initial response
    remoteRefs = remoteHTTP.refs
    symrefs = remoteHTTP.symrefs
    
    if (!remoteRefs) {
      throw new Error('Protocol error: refs not available in protocol v1 response')
    }
    
    console.log(`[Git Protocol] Fetch using protocol v${remoteHTTP.protocolVersion}, found ${remoteRefs.size} refs`)
  }
  
  // For the special case of an empty repository with no refs, return null
  if (remoteRefs.size === 0) {
    return {
      defaultBranch: null,
      fetchHead: null,
      fetchHeadDescription: null,
    }
  }
  
  // Get capabilities (different format for v1 vs v2)
  let capabilities: Set<string>
  if (remoteHTTP.protocolVersion === 2) {
    // Convert v2 capabilities to Set for compatibility
    capabilities = new Set<string>()
    for (const [key, value] of Object.entries(remoteHTTP.capabilities2)) {
      if (value === true) {
        capabilities.add(key)
      } else {
        capabilities.add(`${key}=${value}`)
      }
    }
  } else {
    capabilities = remoteHTTP.capabilities
  }
  
  // Check that the remote supports the requested features
  if (depth !== null && !capabilities.has('shallow')) {
    throw new RemoteCapabilityError('shallow', 'depth')
  }
  if (since !== null && !capabilities.has('deepen-since')) {
    throw new RemoteCapabilityError('deepen-since', 'since')
  }
  if (exclude.length > 0 && !capabilities.has('deepen-not')) {
    throw new RemoteCapabilityError('deepen-not', 'exclude')
  }
  if (relative === true && !capabilities.has('deepen-relative')) {
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
  // Use the capabilities we extracted (works for both v1 and v2)
  const filteredCaps = filterCapabilities(
    [...capabilities],
    [
      'multi_ack_detailed',
      'no-done',
      'side-band-64k',
      'ofs-delta',
      `agent=${pkg.agent}`,
    ]
  )
  if (relative) filteredCaps.push('deepen-relative')
  
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
  
  const oids = await readShallow({ fs, gitdir })
  const shallows = capabilities.has('shallow') ? [...oids] : []
  
  const packstream = writeUploadPackRequest({
    capabilities: filteredCaps,
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
  console.log(`[DEBUG fetch] parseUploadPackResponse completed. ACKs: ${response.acks.length}, NAK: ${response.nak}`)
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
  
  await writeShallow({ fs, gitdir, oids })
  
  // Update local remote refs
  if (singleBranch) {
    const refs = new Map([[fullref, oid]])
    const symrefs = new Map()
    let bail = 10
    let key = fullref
    while (bail--) {
      const value = symrefs.get(key)
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
      symrefs: symrefs,
      tags,
      prune,
      pruneTags,
    })
    if (prune) {
      response.pruned = pruned
    }
  }
  
  response.HEAD = symrefs.get('HEAD')
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
  
  console.log(`[DEBUG fetch] About to collect packfile from FIFO...`)
  const packfile = Buffer.from(await collect(response.packfile))
  console.log(`[DEBUG fetch] Collected packfile: size=${packfile.length} bytes`)
  if (raw.body.error) throw raw.body.error
  const packfileSha = packfile.length >= 20 ? packfile.slice(-20).toString('hex') : ''
  const isEmpty = packfile.length > 0 ? emptyPackfile(packfile) : true
  console.log(`[DEBUG fetch] Packfile info: sha=${packfileSha}, size=${packfile.length}, empty=${isEmpty}`)
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
    console.log(`[DEBUG fetch] Packfile is valid, will write to disk`)
    res.packfile = `objects/pack/pack-${packfileSha}.pack`
    const fullpath = join(gitdir, res.packfile)
    // Ensure the pack directory exists
    // FileSystem.mkdir already implements recursive directory creation
    const packDir = join(gitdir, 'objects', 'pack')
    await normalizedFs.mkdir(packDir)
    
    // Create index from packfile first (before writing to disk)
    // We need getExternalRefDelta to be able to read from the packfile being indexed
    const packfileBuffer = Buffer.isBuffer(packfile) ? packfile : Buffer.from(packfile)
    
    // Create a getExternalRefDelta that can read from the packfile being indexed
    // The key insight: during fromPack, the GitPackIndex instance 'p' is created and
    // objects are resolved incrementally. We need to make getExternalRefDelta use 'p'
    // to read objects that have already been resolved.
    // Since fromPack doesn't expose 'p' to getExternalRefDelta, we'll use a workaround:
    // we'll modify fromPack to pass 'p' via a closure, or we'll scan the packfile.
    // Actually, the simplest solution is to make getExternalRefDelta use the packfile
    // buffer directly by creating a temporary index for reading.
    
    // Create the index
    // The modified fromPack will now use the index being built to resolve ref-deltas
    // We need to make sure getExternalRefDelta doesn't throw errors for objects that
    // might be in the packfile but not yet resolved - the multi-pass will handle those
    const idx = await GitPackIndex.fromPack({
      pack: packfile,
      getExternalRefDelta: async (oid: string) => {
        // The modified fromPack checks offsets first, so if we get here, the object
        // is not in the packfile being indexed. Try to read from disk (other packfiles or loose).
        try {
          const result = await readObject({ fs, cache, gitdir, oid })
          return { type: result.type || '', object: result.object }
        } catch (err) {
          // If we can't find it on disk, it might be in the packfile but not yet resolved
          // This can happen if the object is a ref-delta that depends on another ref-delta
          // The multi-pass will retry in the next pass
          // However, if the base object truly doesn't exist, we need to throw the error
          // so the object gets skipped and retried
          throw err
        }
      },
      onProgress,
    })
    
    // Write both packfile and index
    console.log(`[DEBUG fetch] Writing packfile to: ${fullpath}`)
    await normalizedFs.write(fullpath, packfile)
    const indexPath = fullpath.replace(/\.pack$/, '.idx')
    const indexBuffer = await idx.toBuffer()
    console.log(`[DEBUG fetch] Writing packfile index to: ${indexPath} (size: ${indexBuffer.length} bytes, objects: ${idx.offsets.size})`)
    await normalizedFs.write(indexPath, indexBuffer)
    
    // Verify the index file was written correctly
    if (!(await normalizedFs.exists(indexPath))) {
      throw new Error(`Failed to write packfile index: ${indexPath}`)
    }
    console.log(`[DEBUG fetch] Packfile index verified to exist: ${indexPath}`)
    
    // Store the index in cache so it's immediately available for reading
    // This ensures objects can be found right after fetch completes
    // Populate both cache systems: loadIndex (symbol) and readPackIndex (string)
    idx.pack = Promise.resolve(packfileBuffer)
    
    // Cache for loadIndex (used by readPacked in PackfileReader)
    const PackfileCache = Symbol('PackfileCache')
    if (!cache[PackfileCache]) {
      cache[PackfileCache] = new Map<string, GitPackIndex>()
    }
    const cacheMap1 = cache[PackfileCache] as Map<string, GitPackIndex>
    cacheMap1.set(indexPath, idx)
    
    // Cache for readPackIndex (used by packfileIterator)  
    const cacheKey = PackfileCache as unknown as string
    if (!cache[cacheKey]) {
      cache[cacheKey] = new Map<string, Promise<GitPackIndex | undefined>>()
    }
    const cacheMap2 = cache[cacheKey] as Map<string, Promise<GitPackIndex | undefined>>
    cacheMap2.set(indexPath, Promise.resolve(idx))
    
    // Also cache using just the filename (not full path) in case that's what's used
    const filename = indexPath.split('/').pop() || indexPath.split('\\').pop() || ''
    if (filename) {
      const filenamePath = `${gitdir}/objects/pack/${filename}`
      cacheMap1.set(filenamePath, idx)
      cacheMap2.set(filenamePath, Promise.resolve(idx))
    }
    
      // Verify that fetchHead is in the index after fromPack completes
      // If it's not, the object might still be readable from the packfile
      // (e.g., if it's a ref-delta that couldn't be resolved during indexing)
      const fetchHeadInIndex = idx.offsets.has(res.fetchHead)
      if (!fetchHeadInIndex) {
        // The fetchHead might be in the packfile but not indexed
        // This can happen if it's a ref-delta whose base object wasn't available during indexing
        // Try to read it directly - if it works, that's fine (readObject will handle it)
        // If it doesn't work, we'll get an error during checkout which is more informative
        console.warn(`[Packfile Index] fetchHead ${res.fetchHead} not found in packfile index after indexing. Total objects in index: ${idx.offsets.size}`)
        
        // Try to find it by scanning the packfile
        try {
          const testRead = await idx.read({ oid: res.fetchHead })
          console.log(`[Packfile Index] fetchHead ${res.fetchHead} is readable via packfile read() even though not in index`)
        } catch (err) {
          console.error(`[Packfile Index] fetchHead ${res.fetchHead} cannot be read from packfile:`, err)
        }
      } else {
        console.log(`[Packfile Index] fetchHead ${res.fetchHead} found in index at offset ${idx.offsets.get(res.fetchHead)}`)
      }
    }

    return res
}

