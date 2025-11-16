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
      
      // Initialize target repository (non-bare if dir is provided)
      await _init({ fs, dir, gitdir, bare: false })
      
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
      
      // Don't copy HEAD from source - we'll set it after creating the branch ref
      // This ensures HEAD points to the correct branch we're cloning
      
      // Initialize empty index (don't copy from source)
      // Create an empty index file with version 2 header and proper checksum
      const { GitIndex } = await import('../git/index/GitIndex.ts')
      const emptyIndex = new GitIndex()
      const indexBuffer = await emptyIndex.toObject()
      await fs.write(join(gitdir, 'index'), indexBuffer)
      
      // Don't copy config - let _init create a fresh one, then add remote
      // (we already added remote above, so config should be set up)
      
      // Resolve the ref to checkout from source repository first
      const checkoutRef = ref || 'HEAD'
      let fetchHead: string | null = null
      
      // CRITICAL: Use resolveRef, writeRef, and writeSymbolicRef directly to avoid circular import issues with RefManager
      const { resolveRef } = await import('../git/refs/readRef.ts')
      const { writeRef, writeSymbolicRef } = await import('../git/refs/writeRef.ts')
      
      // Try to resolve from source repository first
      // CRITICAL: Try multiple resolution strategies to find the ref
      try {
        fetchHead = await resolveRef({ fs: sourceFs as any, gitdir: sourceGitDir, ref: checkoutRef })
      } catch {
        // Try to resolve as branch in source
        try {
          fetchHead = await resolveRef({ fs: sourceFs as any, gitdir: sourceGitDir, ref: `refs/heads/${checkoutRef}` })
        } catch {
          // Try to resolve as tag in source
          try {
            fetchHead = await resolveRef({ fs: sourceFs as any, gitdir: sourceGitDir, ref: `refs/tags/${checkoutRef}` })
          } catch {
            // Try to get default branch from source HEAD
            try {
              const sourceHeadContent = await sourceFs.read(join(sourceGitDir, 'HEAD'), 'utf8')
              if (typeof sourceHeadContent === 'string' && sourceHeadContent.startsWith('ref: ')) {
                const sourceRef = sourceHeadContent.slice(5).trim()
                try {
                  fetchHead = await resolveRef({ fs: sourceFs as any, gitdir: sourceGitDir, ref: sourceRef })
                } catch {
                  fetchHead = null
                }
              } else {
                fetchHead = null
              }
            } catch {
              fetchHead = null
            }
          }
        }
      }
      
      if (fetchHead === null) return
      // Determine what to checkout
      const baseRef = checkoutRef.replace('refs/heads/', '').replace('refs/tags/', '')
      // CRITICAL: Use Repository to ensure consistent fs instance
      const { Repository } = await import('../core-utils/Repository.ts')
      const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
      const normalizedFs = repo.fs
      const tagRefPath = join(gitdir, 'refs', 'tags', baseRef)
      const isTag = await normalizedFs.exists(tagRefPath)
      
      // If it's a branch (not a tag), create the local branch ref pointing to fetchHead
      if (!isTag) {
        await writeRef({
          fs: normalizedFs,
          gitdir,
          ref: `refs/heads/${baseRef}`,
          value: fetchHead,
        })
      }
      
      // If noCheckout is true, just update HEAD without checking out files
      if (noCheckout) {
        // Update HEAD to point to the branch or tag
        // For tags, use the OID directly (detached HEAD)
        // For branches, use the ref name (symbolic ref)
        if (isTag) {
          await writeRef({
            fs: normalizedFs,
            gitdir,
            ref: 'HEAD',
            value: fetchHead,
          })
        } else {
          // For branches, write HEAD as a symbolic ref pointing to the branch
          await writeSymbolicRef({
            fs: normalizedFs,
            gitdir,
            ref: 'HEAD',
            value: `refs/heads/${baseRef}`,
          })
        }
      } else {
        // CRITICAL: Set up HEAD before checkout to ensure it exists
        // This prevents "Could not find HEAD" errors during checkout
        if (isTag) {
          // For tags, set HEAD to point to the tag OID (detached HEAD)
          await writeRef({
            fs: normalizedFs,
            gitdir,
            ref: 'HEAD',
            value: fetchHead,
          })
        } else {
          // For branches, set HEAD as a symbolic ref pointing to the branch
          await writeSymbolicRef({
            fs: normalizedFs,
            gitdir,
            ref: 'HEAD',
            value: `refs/heads/${baseRef}`,
          })
        }
        
        // Checkout (use force to overwrite any existing files)
        // CRITICAL: Set noUpdateHead: true since we already set HEAD above
        // This prevents checkout from trying to update HEAD and potentially removing it
        if (isTag) {
          await _checkout({
            fs: normalizedFs,
            cache,
            onProgress,
            onPostCheckout,
            dir: dir!,
            gitdir,
            ref: `refs/tags/${baseRef}`,
            remote,
            noCheckout: false,
            noUpdateHead: true, // We already set HEAD above
            nonBlocking,
            batchSize,
            force: true, // Force checkout to overwrite any existing files
          })
        } else {
          await _checkout({
            fs: normalizedFs,
            cache,
            onProgress,
            onPostCheckout,
            dir: dir!,
            gitdir,
            ref: baseRef,
            remote,
            noCheckout: false,
            noUpdateHead: true, // We already set HEAD above
            nonBlocking,
            batchSize,
            force: true, // Force checkout to overwrite any existing files
          })
        }
      }
      
      return
    }
    
    // Initialize repository (non-bare if dir is provided)
    await _init({ fs, dir, gitdir, bare: false })
    
    // Initialize empty index file (required for checkout)
    const { GitIndex } = await import('../git/index/GitIndex.ts')
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
      // CRITICAL: Use Repository to ensure consistent config access
      const { Repository } = await import('../core-utils/Repository.ts')
      const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
      const configService = await repo.getConfig()
      await configService.set('http.corsProxy', corsProxy, 'local')
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
    
    // DEBUG: Log fetch results
    console.log('[DEBUG clone] Fetch complete.')
    console.log(`[DEBUG clone] fetchHead: ${fetchHead}`)
    console.log(`[DEBUG clone] defaultBranch: ${defaultBranch}`)
    
    if (fetchHead === null) {
      console.log('[DEBUG clone] fetchHead is null, returning early.')
      return
    }
    
    // Note: The fetched object should be available in the packfile that was just written.
    // We don't need to verify it here because checkout will handle reading it.
    
    // CRITICAL: Use Repository to ensure consistent fs instance
    const { Repository } = await import('../core-utils/Repository.ts')
    const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig: true })
    const normalizedFs = repo.fs
    
    // CRITICAL: Import ref functions directly to avoid circular import issues with RefManager
    const { resolveRef: resolveRefRemote } = await import('../git/refs/readRef.ts')
    const { writeRef: writeRefRemote, writeSymbolicRef: writeSymbolicRefRemote } = await import('../git/refs/writeRef.ts')
    
    // Determine what to checkout
    let checkoutRef = ref || defaultBranch
    console.log(`[DEBUG clone] Determined checkoutRef: ${checkoutRef}`)
    
    // If no ref specified and defaultBranch is not available, try to find a default branch
    // from the remote refs (e.g., 'master', 'main', 'trunk')
    if (!checkoutRef && fetchHead) {
      // Try common default branch names
      const commonDefaultBranches = ['master', 'main', 'trunk', 'develop', 'default']
      for (const branchName of commonDefaultBranches) {
        const remoteBranchRef = `refs/remotes/${remote}/${branchName}`
        try {
          const branchOid = await resolveRefRemote({ fs: normalizedFs, gitdir, ref: remoteBranchRef })
          if (branchOid === fetchHead) {
            checkoutRef = branchName
            console.log(`[DEBUG clone] Found default branch '${branchName}' from remote refs`)
            break
          }
        } catch {
          // Branch doesn't exist, try next
        }
      }
    }
    
    // If still no checkoutRef but we have fetchHead, try to create a branch
    // First, try to find any remote branch that matches fetchHead
    if (!checkoutRef && fetchHead) {
      // List all remote branches and find one that matches fetchHead
      try {
        const remoteRefsDir = join(gitdir, 'refs', 'remotes', remote)
        const remoteBranches: string[] = []
        
        // Recursively read remote refs directory
        const readRemoteRefs = async (dir: string, prefix: string = ''): Promise<void> => {
          try {
            const entries = await normalizedFs.readdir(dir)
            for (const entry of entries) {
              const fullPath = join(dir, entry)
              const stat = await normalizedFs.lstat(fullPath)
              if (stat && stat.isDirectory()) {
                await readRemoteRefs(fullPath, prefix ? `${prefix}/${entry}` : entry)
              } else {
                const refPath = prefix ? `${prefix}/${entry}` : entry
                remoteBranches.push(refPath)
              }
            }
          } catch {
            // Directory doesn't exist or can't be read
          }
        }
        
        await readRemoteRefs(remoteRefsDir)
        
        // Find a branch that matches fetchHead
        for (const branchName of remoteBranches) {
          try {
            const remoteBranchRef = `refs/remotes/${remote}/${branchName}`
            const branchOid = await resolveRefRemote({ fs: normalizedFs, gitdir, ref: remoteBranchRef })
            if (branchOid === fetchHead) {
              checkoutRef = branchName
              console.log(`[DEBUG clone] Found matching branch '${branchName}' from remote refs`)
              break
            }
          } catch {
            // Branch doesn't exist or can't be resolved, try next
          }
        }
      } catch {
        // Can't read remote refs, will fall back to creating a branch
      }
      
      // If still no checkoutRef, create a branch with a default name
      if (!checkoutRef && fetchHead) {
        // Use 'master' as the default branch name (common default)
        checkoutRef = 'master'
        console.log(`[DEBUG clone] No branch found, using default branch name '${checkoutRef}'`)
      }
    }
    
    if (!checkoutRef) {
      console.log('[DEBUG clone] No ref to checkout, finishing clone.')
      return
    }
    
    // Remove 'refs/heads/' or 'refs/tags/' prefix if present to get the base name
    const baseRef = checkoutRef.replace('refs/heads/', '').replace('refs/tags/', '')
    console.log(`[DEBUG clone] baseRef: ${baseRef}`)
    
    // Check if ref is a tag by checking if the tag ref file exists
    const tagRefPath = join(gitdir, 'refs', 'tags', baseRef)
    const isTag = await normalizedFs.exists(tagRefPath)
    console.log(`[DEBUG clone] isTag: ${isTag}`)
    
    // If it's a branch (not a tag), create the local branch ref pointing to fetchHead
    if (!isTag) {
      console.log(`[DEBUG clone] Attempting to write local branch 'refs/heads/${baseRef}' to point to ${fetchHead}`)
      await writeRefRemote({
        fs: normalizedFs,
        gitdir,
        ref: `refs/heads/${baseRef}`,
        value: fetchHead,
      })
      console.log(`[DEBUG clone] Successfully wrote local branch 'refs/heads/${baseRef}'.`)
      
      // Verify the ref was written correctly
      try {
        const localOid = await resolveRefRemote({ fs: normalizedFs, gitdir, ref: `refs/heads/${baseRef}` })
        console.log(`[DEBUG clone] Verified local branch 'refs/heads/${baseRef}' exists and points to ${localOid}`)
      } catch (e) {
        console.error(`[DEBUG clone] FAILED to verify local branch 'refs/heads/${baseRef}':`, e)
      }
    }
    
    // If noCheckout is true, just update HEAD without checking out files
    if (noCheckout) {
      // Update HEAD to point to the branch or tag
      // For tags, use the OID directly (detached HEAD)
      // For branches, use the ref name (symbolic ref)
      if (isTag) {
        await writeRefRemote({
          fs: normalizedFs,
          gitdir,
          ref: 'HEAD',
          value: fetchHead,
        })
      } else {
        // For branches, write HEAD as a symbolic ref pointing to the branch
        await writeSymbolicRefRemote({
          fs: normalizedFs,
          gitdir,
          ref: 'HEAD',
          value: `refs/heads/${baseRef}`,
        })
      }
      console.log(`[DEBUG clone] Updated HEAD without checkout (noCheckout=true)`)
    } else {
      // Ensure dir is provided when noCheckout is false
      if (!dir) {
        throw new Error('dir is required when noCheckout is false')
      }
      
      // CRITICAL: Set up HEAD before checkout to ensure it exists
      // This prevents "Could not find HEAD" errors during checkout
      if (isTag) {
        // For tags, set HEAD to point to the tag OID (detached HEAD)
        await writeRefRemote({
          fs: normalizedFs,
          gitdir,
          ref: 'HEAD',
          value: fetchHead,
        })
      } else {
        // For branches, set HEAD as a symbolic ref pointing to the branch
        await writeSymbolicRefRemote({
          fs: normalizedFs,
          gitdir,
          ref: 'HEAD',
          value: `refs/heads/${baseRef}`,
        })
      }
      
      // CRITICAL: Clear Repository cache before checkout to ensure fresh instance
      // This prevents "Cannot checkout in bare repository" errors from stale cache
      const { Repository } = await import('../core-utils/Repository.ts')
      Repository.clearInstanceCache()
      
      // If it's a tag, checkout the tag directly (detached HEAD)
      // Otherwise checkout as a branch
      if (isTag) {
        // For tags, checkout the tag ref directly
        console.log(`[DEBUG clone] Attempting to checkout tag ref: 'refs/tags/${baseRef}'`)
        await _checkout({
          fs: normalizedFs,
          cache,
          onProgress,
          onPostCheckout,
          dir,
          gitdir,
          ref: `refs/tags/${baseRef}`,
          remote,
          noCheckout: false,
          noUpdateHead: false,
          nonBlocking,
          batchSize,
          force: true, // Force checkout to overwrite any existing files
        })
        console.log(`[DEBUG clone] Successfully checked out tag 'refs/tags/${baseRef}'`)
      } else {
        // For branches, checkout normally
        console.log(`[DEBUG clone] Attempting to checkout branch ref: '${baseRef}'`)
        await _checkout({
          fs: normalizedFs,
          cache,
          onProgress,
          onPostCheckout,
          dir,
          gitdir,
          ref: baseRef,
          remote,
          noCheckout: false,
          noUpdateHead: false,
          nonBlocking,
          batchSize,
          force: true, // Force checkout to overwrite any existing files
        })
        console.log(`[DEBUG clone] Successfully checked out branch '${baseRef}'`)
      }
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
  // FileSystem.mkdir already implements recursive directory creation
  await normalizedTargetFs.mkdir(targetPath)
  
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

