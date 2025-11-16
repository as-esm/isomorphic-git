import { MissingNameError } from "../errors/MissingNameError.ts"
import { MissingParameterError } from "../errors/MissingParameterError.ts"
import { NoCommitError } from "../errors/NoCommitError.ts"
import { UnmergedPathsError } from "../errors/UnmergedPathsError.ts"
import { GitIndex } from "../git/index/GitIndex.ts"
// RefManager import removed - using Repository.resolveRef/writeRef methods instead
import { appendReflog } from "../core-utils/refs/ReflogManager.ts"
import { writeObject } from "../git/objects/writeObject.ts"
import { parse as parseCommit, serialize as serializeCommit } from "../core-utils/parsers/Commit.ts"
import { parse as parseTree, serialize as serializeTree } from "../core-utils/parsers/Tree.ts"
import { signCommit } from "../core-utils/Signing.ts"
import { formatAuthor } from "../utils/formatAuthor.ts"
import { flatFileListToDirectoryStructure } from "../utils/flatFileListToDirectoryStructure.ts"
import { normalizeAuthorObject } from "../utils/normalizeAuthorObject.ts"
import { normalizeCommitterObject } from "../utils/normalizeCommitterObject.ts"
import { readObject } from "../git/objects/readObject.ts"
import { Repository } from "../core-utils/Repository.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import AsyncLock from 'async-lock'
import type { FsClient } from "../models/FileSystem.ts"
import type { CommitObject, Author } from "../models/GitCommit.ts"
import type { SignCallback } from "../core-utils/Signing.ts"

let indexLock: AsyncLock | undefined

/**
 * Create a new commit
 */
export async function commit({
  fs,
  onSign,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  message,
  author,
  committer,
  signingKey,
  amend = false,
  dryRun = false,
  noUpdateBranch = false,
  ref,
  parent,
  tree,
  cache = {},
  autoDetectConfig = true,
}: {
  fs: FsClient
  onSign?: SignCallback
  dir?: string
  gitdir?: string
  message?: string
  author?: Partial<Author>
  committer?: Partial<Author>
  signingKey?: string
  amend?: boolean
  dryRun?: boolean
  noUpdateBranch?: boolean
  ref?: string
  parent?: string[]
  tree?: string
  cache?: Record<string, unknown>
  autoDetectConfig?: boolean
}): Promise<string> {
  try {
    assertParameter('fs', fs)
    assertParameter('gitdir', gitdir!)
    if (!amend) {
      assertParameter('message', message)
    }
    if (signingKey) {
      assertParameter('onSign', onSign)
    }

    // CRITICAL: Use Repository to ensure state consistency
    // This ensures that add() and commit() use the same Repository instance and config service
    const { Repository } = await import('../core-utils/Repository.ts')
    const repo = await Repository.open({ fs, dir, gitdir, cache, autoDetectConfig })
    const effectiveGitdir = await repo.getGitdir()

    return await _commit({
      fs,
      cache,
      onSign,
      gitdir: effectiveGitdir,
      message,
      author,
      committer,
      signingKey,
      amend,
      dryRun,
      noUpdateBranch,
      ref,
      parent,
      tree,
      repo,
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.commit'
    throw err
  }
}

/**
 * Internal commit implementation
 * @internal - Exported for use by other commands (e.g., addNote, removeNote, merge)
 */
export async function _commit({
  fs: _fs,
  cache: _cache,
  onSign,
  gitdir: _gitdir,
  message,
  author: _author,
  committer: _committer,
  signingKey,
  amend = false,
  dryRun = false,
  noUpdateBranch = false,
  ref,
  parent,
  tree,
  repo,
}: {
  fs?: FsClient
  cache?: Record<string, unknown>
  onSign?: SignCallback
  gitdir?: string
  message?: string
  author?: Partial<Author>
  committer?: Partial<Author>
  signingKey?: string
  amend?: boolean
  dryRun?: boolean
  noUpdateBranch?: boolean
  ref?: string
  parent?: string[]
  tree?: string
  repo?: Repository
}): Promise<string> {
  // Extract parameters from Repository if provided
  const fs = repo?.fs || _fs!
  const cache = repo?.cache || _cache || {}
  let gitdir = _gitdir || (repo ? await repo.getGitdir() : undefined)
  
  if (!fs) throw new MissingParameterError('fs')
  if (!gitdir) throw new MissingParameterError('gitdir')
  
  // If Repository is provided, use worktree's gitdir to ensure we're using the correct index
  if (repo) {
    const worktree = repo.getWorktree()
    if (worktree) {
      gitdir = await worktree.getGitdir()
    }
  }
  // Determine ref and the commit pointed to by ref, and if it is the initial commit
  let initialCommit = false
  if (!ref) {
    // Try to resolve HEAD to get the ref (e.g., 'refs/heads/master')
    // If HEAD doesn't exist (fresh repo), we'll determine the default branch
    try {
      // Use Repository.resolveRef() or direct resolveRef() for consistency
      if (repo) {
        ref = await repo.resolveRef('HEAD', 2) // depth 2 to resolve symbolic refs
      } else {
        const { resolveRef } = await import('../git/refs/readRef.ts')
        ref = await resolveRef({ fs, gitdir, ref: 'HEAD', depth: 2 })
      }
    } catch {
      // HEAD doesn't exist - get default branch from config (defaults to 'master')
      let defaultBranch = 'master'
      try {
        const { ConfigAccess } = await import('../utils/configAccess.ts')
        const configAccess = new ConfigAccess(fs, gitdir)
        const initDefaultBranch = await configAccess.getConfigValue('init.defaultBranch')
        if (initDefaultBranch && typeof initDefaultBranch === 'string') {
          defaultBranch = initDefaultBranch
        }
      } catch {
        // Config doesn't exist or can't be read, use 'master'
      }
      // Default to the branch ref (will create branch and set HEAD to point to it)
      ref = `refs/heads/${defaultBranch}`
    }
  }

  // Try to resolve the ref to get the commit OID
  let refOid: string | undefined
  let refCommit: CommitObject | undefined
  try {
    // Use Repository.resolveRef() or direct resolveRef() for consistency
    if (repo) {
      refOid = await repo.resolveRef(ref)
    } else {
      const { resolveRef } = await import('../git/refs/readRef.ts')
      refOid = await resolveRef({ fs, gitdir, ref })
    }
    const commitResult = await readObject({ fs, cache, gitdir, oid: refOid, format: 'content' })
    if (commitResult.type === 'commit') {
      refCommit = parseCommit(commitResult.object) as CommitObject
    }
  } catch {
    // We assume that there's no commit and this is the initial commit
    initialCommit = true
  }

  // If amend is requested but there's no commit to amend, throw error
  if (amend && initialCommit) {
    throw new NoCommitError(ref)
  }

  // Determine author and committer information
  // CRITICAL: repo is required for normalizeAuthorObject and normalizeCommitterObject
  if (!repo) {
    throw new Error('Repository instance is required for commit')
  }
  
  const author = !amend
    ? await normalizeAuthorObject({ repo, author: _author })
    : await normalizeAuthorObject({
        repo,
        author: _author,
        commit: refCommit,
      })
  if (!author) throw new MissingNameError('author')

  const committer = !amend
    ? await normalizeCommitterObject({
        repo,
        author,
        committer: _committer,
      })
    : await normalizeCommitterObject({
        repo,
        author,
        committer: _committer,
        commit: refCommit,
      })
  if (!committer) throw new MissingNameError('committer')

  // Acquire index lock
  if (!indexLock) {
    indexLock = new AsyncLock({ maxPending: Infinity })
  }

  const indexPath = join(gitdir, 'index')
  return indexLock.acquire(indexPath, async () => {
    // Read index using Repository.readIndexDirect() if repo is available
    // This ensures proper unmerged paths detection
    let index
    if (repo) {
      try {
        index = await repo.readIndexDirect(false, false) // Force fresh read, allowUnmerged: false
        // If there are unmerged paths, readIndexDirect will throw UnmergedPathsError
      } catch (error) {
        // If readIndexDirect throws UnmergedPathsError, re-throw it
        if (error instanceof UnmergedPathsError) {
          throw error
        }
        // For other errors, fall back to direct file read
        let indexBuffer = Buffer.alloc(0)
        try {
          const indexData = await fs.read(indexPath)
          indexBuffer = Buffer.isBuffer(indexData) ? indexData : Buffer.from(indexData as string | Uint8Array)
        } catch {
          // Index doesn't exist yet
        }
        if (indexBuffer.length === 0) {
          index = new GitIndex(null, null, 2)
        } else {
          index = await GitIndex.fromBuffer(indexBuffer)
        }
        if (index.unmergedPaths.length > 0) {
          throw new UnmergedPathsError(index.unmergedPaths)
        }
      }
    } else {
      // Fallback: read index directly from file
      let indexBuffer = Buffer.alloc(0)
      try {
        const indexData = await fs.read(indexPath)
        indexBuffer = Buffer.isBuffer(indexData) ? indexData : Buffer.from(indexData as string | Uint8Array)
      } catch {
        // Index doesn't exist yet
      }

      // Handle empty index - create an empty index object instead of parsing
      if (indexBuffer.length === 0) {
        // Empty index - create a minimal index object with default version
        index = new GitIndex(null, null, 2)
      } else {
        index = await GitIndex.fromBuffer(indexBuffer)
      }

      // Check for unmerged paths
      if (index.unmergedPaths.length > 0) {
        throw new UnmergedPathsError(index.unmergedPaths)
      }
    }

    // Build tree from index
    const entries = index.entries.flatMap(entry => {
      // Get the main entry (stage 0) or the first stage
      const mainEntry = entry.stages.length > 0 ? entry.stages[0] : entry
      return mainEntry ? [mainEntry] : []
    })

    const inodes = flatFileListToDirectoryStructure(entries)
    const inode = inodes.get('.')
    if (!tree) {
      tree = await constructTree({ fs, gitdir, inode, dryRun, cache })
    }

    // Determine parents of this commit
    let commitParents: string[]
    if (!parent) {
      if (!amend) {
        commitParents = refOid ? [refOid] : []
      } else {
        commitParents = refCommit?.parent || []
      }
    } else {
      // ensure that the parents are oids, not refs
      // Use Repository.resolveRef() or direct resolveRef() for consistency
      if (repo) {
        commitParents = await Promise.all(
          parent.map(p => repo.resolveRef(p))
        )
      } else {
        const { resolveRef } = await import('../git/refs/readRef.ts')
        commitParents = await Promise.all(
          parent.map(p => resolveRef({ fs, gitdir, ref: p }))
        )
      }
    }

    // Determine message of this commit
    let commitMessage: string
    if (!message) {
      if (!amend) {
        throw new MissingParameterError('message')
      } else {
        commitMessage = refCommit?.message || ''
      }
    } else {
      commitMessage = message
    }

    // Create commit object
    let commitObj: CommitObject = {
      tree: tree || '4b825dc642cb6eb9a060e54bf8d69288fbee4904', // empty tree
      parent: commitParents,
      author,
      committer,
      message: commitMessage,
    }

    // Sign commit if requested
    if (signingKey && onSign) {
      const headers = renderCommitHeaders(commitObj)
      const signedHeaders = await signCommit({
        headers,
        message: commitMessage,
        signer: onSign,
        secretKey: signingKey,
      })
      // Parse the signed commit to get the gpgsig
      const signedCommit = parseCommit(signedHeaders)
      commitObj = { ...commitObj, gpgsig: signedCommit.gpgsig }
    }

    // Write commit object
    const commitBuffer = serializeCommit(commitObj)
    const oid = await writeObject({
      fs,
      gitdir,
      type: 'commit',
      object: commitBuffer,
      format: 'content',
      dryRun,
    })

    if (!noUpdateBranch && !dryRun) {
      // Update branch pointer
      const oldOid = refOid || '0000000000000000000000000000000000000000'
      
      // For initial commits, we need to:
      // 1. Create the branch ref (e.g., refs/heads/master)
      // 2. Set HEAD to point to that branch (if HEAD doesn't exist or is detached)
      if (initialCommit && ref.startsWith('refs/heads/')) {
        // Write the branch ref
        if (repo) {
          await repo.writeRef(ref, oid)
        } else {
          const { writeRef } = await import('../git/refs/writeRef.ts')
          await writeRef({ fs, gitdir, ref, value: oid })
        }
        
        // Set HEAD to point to this branch (if HEAD doesn't exist or is detached)
        try {
          // Try to read HEAD to see if it exists and what it points to
          const { readRef } = await import('../git/refs/readRef.ts')
          const headRef = await readRef({ fs, gitdir, ref: 'HEAD' })
          // If HEAD exists and is already a symbolic ref pointing to our branch, we're good
          if (headRef && typeof headRef === 'string' && headRef.startsWith('ref: ') && headRef.includes(ref)) {
            // HEAD already points to this branch, nothing to do
          } else {
            // HEAD is detached or doesn't exist, update it
            const branchName = ref.replace('refs/heads/', '')
            if (repo) {
              await repo.writeSymbolicRefDirect('HEAD', `refs/heads/${branchName}`)
            } else {
              const { writeSymbolicRef } = await import('../git/refs/writeRef.ts')
              await writeSymbolicRef({ fs, gitdir, ref: 'HEAD', value: `refs/heads/${branchName}` })
            }
          }
        } catch {
          // HEAD doesn't exist, create it as a symbolic ref pointing to the branch
          const branchName = ref.replace('refs/heads/', '')
          if (repo) {
            await repo.writeSymbolicRefDirect('HEAD', `refs/heads/${branchName}`)
          } else {
            const { writeSymbolicRef } = await import('../git/refs/writeRef.ts')
            await writeSymbolicRef({ fs, gitdir, ref: 'HEAD', value: `refs/heads/${branchName}` })
          }
        }
      } else {
        // Normal commit - just update the ref
        // Use Repository.writeRef() or direct writeRef() for consistency
        // DEBUG: Log ref and OID being written for native git compatibility debugging
        if (process.env.DEBUG_COMMIT_REFS === 'true') {
          console.log(`[DEBUG] Writing ref: ${ref} -> ${oid}`)
        }
        if (repo) {
          await repo.writeRef(ref, oid)
        } else {
          const { writeRef } = await import('../git/refs/writeRef.ts')
          await writeRef({ fs, gitdir, ref, value: oid })
        }
      }

      // Write reflog entry
      try {
        await appendReflog({
          fs,
          gitdir,
          ref,
          entry: {
            oldOid,
            newOid: oid,
            author: `${committer.name} <${committer.email}>`,
            timestamp: committer.timestamp,
            timezoneOffset: String(committer.timezoneOffset).padStart(5, '0'),
            message: amend ? `commit (amend): ${commitMessage.split('\n')[0]}` : `commit: ${commitMessage.split('\n')[0]}`,
          },
        })
      } catch {
        // Reflog might not be enabled, ignore
      }
    }

    return oid
  })
}

/**
 * Renders commit headers (without message)
 */
function renderCommitHeaders(commit: CommitObject): string {
  let headers = ''
  if (commit.tree) {
    headers += `tree ${commit.tree}\n`
  }
  if (commit.parent) {
    for (const p of commit.parent) {
      headers += `parent ${p}\n`
    }
  }
  headers += `author ${formatAuthor(commit.author)}\n`
  headers += `committer ${formatAuthor(commit.committer || commit.author)}\n`
  return headers
}


/**
 * Constructs a tree from an inode structure
 */
async function constructTree({
  fs,
  gitdir,
  inode,
  dryRun,
  cache,
}: {
  fs: FsClient
  gitdir: string
  inode: { children: Array<{ type: string; basename: string; metadata: { mode?: string; oid?: string } }> }
  dryRun: boolean
  cache: Record<string, unknown>
}): Promise<string> {
  // use depth first traversal
  const children = inode.children
  for (const child of children) {
    if (child.type === 'tree') {
      child.metadata.mode = '040000'
      child.metadata.oid = await constructTree({ fs, gitdir, inode: child, dryRun, cache })
    }
  }
  const entries = children.map(child => ({
    mode: child.metadata.mode || '100644',
    path: child.basename,
    oid: child.metadata.oid || '',
    type: child.type as 'tree' | 'blob' | 'commit',
  }))
  const treeBuffer = serializeTree(entries)
  const oid = await writeObject({
    fs,
    gitdir,
    type: 'tree',
    object: treeBuffer,
    format: 'content',
    dryRun,
  })
  return oid
}

