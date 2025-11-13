import { MissingNameError } from '../errors/MissingNameError.js'
import { MissingParameterError } from '../errors/MissingParameterError.js'
import { NoCommitError } from '../errors/NoCommitError.js'
import { parse as parseIndex, serialize as serializeIndex } from '../core-utils/index/Index.js'
import { RefManager } from '../core-utils/refs/RefManager.js'
import { appendReflog } from '../core-utils/refs/ReflogManager.js'
import { write as writeObject } from '../core-utils/odb/ObjectWriter.js'
import { parse as parseCommit, serialize as serializeCommit } from '../core-utils/parsers/Commit.js'
import { parse as parseTree, serialize as serializeTree } from '../core-utils/parsers/Tree.js'
import { signCommit } from '../core-utils/Signing.js'
import { formatAuthor } from '../utils/formatAuthor.js'
import { flatFileListToDirectoryStructure } from '../utils/flatFileListToDirectoryStructure.js'
import { normalizeAuthorObject } from '../utils/normalizeAuthorObject.js'
import { normalizeCommitterObject } from '../utils/normalizeCommitterObject.js'
import { read as readObject } from '../core-utils/odb/ObjectReader.js'
import { Repository } from '../core-utils/Repository.js'
import { join } from '../utils/join.js'
import AsyncLock from 'async-lock'
import type { FsClient } from '../models/FileSystem.js'
import type { CommitObject, Author } from '../models/GitCommit.js'
import type { SignCallback } from '../core-utils/Signing.js'

let indexLock: AsyncLock | undefined

/**
 * Commits changes to the repository
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
  const gitdir = _gitdir || (repo ? await repo.getGitdir() : undefined)
  
  if (!fs) throw new MissingParameterError('fs')
  if (!gitdir) throw new MissingParameterError('gitdir')
  // Determine ref and the commit pointed to by ref, and if it is the initial commit
  let initialCommit = false
  if (!ref) {
    ref = await RefManager.resolve({
      fs,
      gitdir,
      ref: 'HEAD',
      depth: 2,
    })
  }

  let refOid: string | undefined
  let refCommit: CommitObject | undefined
  try {
    refOid = await RefManager.resolve({
      fs,
      gitdir,
      ref,
    })
    const commitResult = await readObject({ fs, cache, gitdir, oid: refOid, format: 'content' })
    if (commitResult.type === 'commit') {
      refCommit = parseCommit(commitResult.object) as CommitObject
    }
  } catch {
    // We assume that there's no commit and this is the initial commit
    initialCommit = true
  }

  if (amend && initialCommit) {
    throw new NoCommitError(ref)
  }

  // Determine author and committer information
  const author = !amend
    ? await normalizeAuthorObject({ fs, gitdir, author: _author })
    : await normalizeAuthorObject({
        fs,
        gitdir,
        author: _author,
        commit: refCommit,
      })
  if (!author) throw new MissingNameError('author')

  const committer = !amend
    ? await normalizeCommitterObject({
        fs,
        gitdir,
        author,
        committer: _committer,
      })
    : await normalizeCommitterObject({
        fs,
        gitdir,
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
    // Read index
    let indexBuffer = Buffer.alloc(0)
    try {
      const indexData = await fs.read(indexPath)
      indexBuffer = Buffer.isBuffer(indexData) ? indexData : Buffer.from(indexData as string | Uint8Array)
    } catch {
      // Index doesn't exist yet
    }

    const index = await parseIndex(indexBuffer)

    // Check for unmerged paths
    if (index.unmergedPaths.size > 0) {
      throw new Error(`Cannot commit: unmerged paths: ${Array.from(index.unmergedPaths).join(', ')}`)
    }

    // Build tree from index
    const entries = Array.from(index.entries.values()).flatMap(entry => {
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
      commitParents = await Promise.all(
        parent.map(p => {
          return RefManager.resolve({ fs, gitdir, ref: p })
        })
      )
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
      await RefManager.writeRef({
        fs,
        gitdir,
        ref,
        value: oid,
      })

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

