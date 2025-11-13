import { _addRemote } from './addRemote.ts'
import { _checkout } from './checkout.ts'
import { _fetch } from './fetch.ts'
import { _init } from './init.ts'
import { ConfigAccess } from "../utils/configAccess.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { join } from "../utils/join.ts"
import { RefManager } from "../core-utils/refs/RefManager.ts"
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
  protocolVersion?: 1 | 2
}): Promise<void> {
  try {
    // Check if this is a local file path (file:// URL or absolute path)
    const isLocalPath = url.startsWith('file://') || (!url.includes('://') && (url.startsWith('/') || /^[A-Za-z]:/.test(url)))
    
    if (isLocalPath) {
      // Handle local file cloning
      let sourcePath = url
      if (url.startsWith('file://')) {
        sourcePath = url.slice(7) // Remove 'file://' prefix
        // Handle Windows paths: file:///C:/path -> C:/path
        if (sourcePath.startsWith('/') && /^[A-Za-z]:/.test(sourcePath.slice(1))) {
          sourcePath = sourcePath.slice(1)
        }
      }
      
      // Normalize path separators
      sourcePath = sourcePath.replace(/\\/g, '/')
      
      // Use native fs to access the source repository
      const sourceFs = normalizeFs(fs)
      const sourceGitDir = join(sourcePath, '.git')
      
      // Check if source repository exists
      if (!(await sourceFs.exists(sourceGitDir))) {
        throw new Error(`Source repository not found at ${sourcePath}`)
      }
      
      // Initialize target repository
      await _init({ fs, gitdir })
      
      // Add remote
      await _addRemote({ fs, gitdir, remote, url, force: false })
      
      // Copy objects directory
      const sourceObjectsDir = join(sourceGitDir, 'objects')
      const targetObjectsDir = join(gitdir, 'objects')
      await copyDirectory(sourceFs, sourceObjectsDir, fs, targetObjectsDir)
      
      // Copy refs
      const sourceRefsDir = join(sourceGitDir, 'refs')
      const targetRefsDir = join(gitdir, 'refs')
      await copyDirectory(sourceFs, sourceRefsDir, fs, targetRefsDir)
      
      // Copy packed-refs if it exists
      const sourcePackedRefs = join(sourceGitDir, 'packed-refs')
      if (await sourceFs.exists(sourcePackedRefs)) {
        const packedRefsContent = await sourceFs.read(sourcePackedRefs)
        if (packedRefsContent !== null) {
          await fs.write(join(gitdir, 'packed-refs'), packedRefsContent)
        }
      }
      
      // Copy HEAD
      const sourceHead = join(sourceGitDir, 'HEAD')
      if (await sourceFs.exists(sourceHead)) {
        const headContent = await sourceFs.read(sourceHead, 'utf8')
        if (typeof headContent === 'string') {
          await fs.write(join(gitdir, 'HEAD'), headContent, { encoding: 'utf8' })
        }
      }
      
      // Initialize empty index (don't copy from source)
      // Create an empty index file with version 2 header and proper checksum
      const { GitIndex } = await import('../models/GitIndex.ts')
      const emptyIndex = new GitIndex()
      const indexBuffer = await emptyIndex.toObject()
      await fs.write(join(gitdir, 'index'), indexBuffer)
      
      // Don't copy config - let _init create a fresh one, then add remote
      // (we already added remote above, so config should be set up)
      
      // Resolve the ref to checkout from source repository first
      const checkoutRef = ref || 'HEAD'
      let fetchHead: string | null = null
      
      // Try to resolve from source repository first
      try {
        fetchHead = await RefManager.resolve({ fs: sourceFs as any, gitdir: sourceGitDir, ref: checkoutRef })
      } catch {
        // Try to resolve as branch in source
        try {
          fetchHead = await RefManager.resolve({ fs: sourceFs as any, gitdir: sourceGitDir, ref: `refs/heads/${checkoutRef}` })
        } catch {
          // Try to resolve as tag in source
          try {
            fetchHead = await RefManager.resolve({ fs: sourceFs as any, gitdir: sourceGitDir, ref: `refs/tags/${checkoutRef}` })
          } catch {
            // Try to get default branch from source HEAD
            const sourceHeadContent = await sourceFs.read(join(sourceGitDir, 'HEAD'), 'utf8')
            if (typeof sourceHeadContent === 'string' && sourceHeadContent.startsWith('ref: ')) {
              const sourceRef = sourceHeadContent.slice(5).trim()
              try {
                fetchHead = await RefManager.resolve({ fs: sourceFs as any, gitdir: sourceGitDir, ref: sourceRef })
              } catch {
                fetchHead = null
              }
            }
          }
        }
      }
      
      if (fetchHead === null) return
      
      // Determine what to checkout
      const baseRef = checkoutRef.replace('refs/heads/', '').replace('refs/tags/', '')
      const normalizedFs = normalizeFs(fs)
      const tagRefPath = join(gitdir, 'refs', 'tags', baseRef)
      const isTag = await normalizedFs.exists(tagRefPath)
      
      // If it's a branch (not a tag), create the local branch ref pointing to fetchHead
      if (!isTag) {
        await RefManager.writeRef({
          fs,
          gitdir,
          ref: `refs/heads/${baseRef}`,
          value: fetchHead,
        })
      }
      
      // Checkout (use force to overwrite any existing files)
      if (isTag) {
        await _checkout({
          fs,
          cache,
          onProgress,
          onPostCheckout,
          dir,
          gitdir,
          ref: `refs/tags/${baseRef}`,
          remote,
          noCheckout,
          nonBlocking,
          batchSize,
          force: true, // Force checkout to overwrite any existing files
        })
      } else {
        await _checkout({
          fs,
          cache,
          onProgress,
          onPostCheckout,
          dir,
          gitdir,
          ref: baseRef,
          remote,
          noCheckout,
          nonBlocking,
          batchSize,
          force: true, // Force checkout to overwrite any existing files
        })
      }
      
      return
    }
    
    // Initialize repository
    await _init({ fs, gitdir })
    
    // Initialize empty index file (required for checkout)
    const { GitIndex } = await import('../models/GitIndex.ts')
    const emptyIndex = new GitIndex()
    const indexBuffer = await emptyIndex.toObject()
    await fs.write(join(gitdir, 'index'), indexBuffer)
    
    // Add remote (allow overwriting if URL matches)
    try {
      await _addRemote({ fs, gitdir, remote, url, force: false })
    } catch (err) {
      // If remote already exists with different URL, use force to overwrite
      if ((err as { code?: string }).code === 'AlreadyExistsError') {
        await _addRemote({ fs, gitdir, remote, url, force: true })
      } else {
        throw err
      }
    }
    
    // Set corsProxy if provided
    if (corsProxy) {
      const configService = new ConfigAccess(fs, gitdir)
      await configService.setConfigValue('http.corsProxy', corsProxy, 'local')
    }
    
    // Fetch from remote
    console.log(`[Git Protocol] Starting clone operation from ${url}`)
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
      protocolVersion,
    })
    
    if (fetchHead === null) return
    
    // Note: The fetched object should be available in the packfile that was just written.
    // We don't need to verify it here because checkout will handle reading it.
    
    // Determine what to checkout
    const checkoutRef = ref || defaultBranch
    if (!checkoutRef) return
    
    // Remove 'refs/heads/' or 'refs/tags/' prefix if present to get the base name
    const baseRef = checkoutRef.replace('refs/heads/', '').replace('refs/tags/', '')
    
    // Check if ref is a tag by checking if the tag ref file exists
    const normalizedFs = normalizeFs(fs)
    const tagRefPath = join(gitdir, 'refs', 'tags', baseRef)
    const isTag = await normalizedFs.exists(tagRefPath)
    
    // If it's a branch (not a tag), create the local branch ref pointing to fetchHead
    if (!isTag) {
      const { RefManager } = await import('../core-utils/refs/RefManager.ts')
      await RefManager.writeRef({
        fs,
        gitdir,
        ref: `refs/heads/${baseRef}`,
        value: fetchHead,
      })
    }
    
    // If it's a tag, checkout the tag directly (detached HEAD)
    // Otherwise checkout as a branch
    if (isTag) {
      // For tags, checkout the tag ref directly
      await _checkout({
        fs,
        cache,
        onProgress,
        onPostCheckout,
        dir,
        gitdir,
        ref: `refs/tags/${baseRef}`,
        remote,
        noCheckout,
        nonBlocking,
        batchSize,
        force: true, // Force checkout to overwrite any existing files
      })
    } else {
      // For branches, checkout normally
      await _checkout({
        fs,
        cache,
        onProgress,
        onPostCheckout,
        dir,
        gitdir,
        ref: baseRef,
        remote,
        noCheckout,
        nonBlocking,
        batchSize,
        force: true, // Force checkout to overwrite any existing files
      })
    }
  } catch (err) {
    // Remove partial local repository on error
    // Ignore any error as we are already failing.
    // The catch is necessary so the original error is not masked.
    await fs.rmdir(gitdir, { recursive: true, maxRetries: 10 }).catch(() => undefined)
    throw err
  }
}

/**
 * Recursively copy a directory from source to target
 */
async function copyDirectory(
  sourceFs: ReturnType<typeof normalizeFs>,
  sourcePath: string,
  targetFs: FsClient,
  targetPath: string
): Promise<void> {
  const normalizedTargetFs = normalizeFs(targetFs)
  
  // Create target directory
  await normalizedTargetFs.mkdir(targetPath, { recursive: true })
  
  // List source directory
  const entries = await sourceFs.readdir(sourcePath)
  
  for (const entry of entries) {
    const sourceEntryPath = join(sourcePath, entry)
    const targetEntryPath = join(targetPath, entry)
    
    const stats = await sourceFs.lstat(sourceEntryPath)
    if (stats && stats.isDirectory()) {
      // Recursively copy subdirectory
      await copyDirectory(sourceFs, sourceEntryPath, targetFs, targetEntryPath)
    } else {
      // Copy file
      const content = await sourceFs.read(sourceEntryPath)
      if (content !== null) {
        await normalizedTargetFs.write(targetEntryPath, content)
      }
    }
  }
}

