import { _commit } from './commit.ts'
import { _readTree } from './readTree.ts'
import { _writeTree } from './writeTree.ts'
import { AlreadyExistsError } from "../errors/AlreadyExistsError.ts"
import { NotFoundError } from "../errors/NotFoundError.ts"
import { resolveRef } from "../git/refs/readRef.ts"
import { _writeObject as writeObject } from "../storage/writeObject.ts"
import type { Repository } from "../core-utils/Repository.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { SignCallback } from "../core-utils/Signing.ts"
import type { Author } from "../models/GitCommit.ts"

/**
 * Add a note to a commit
 */
export async function _addNote({
  fs,
  cache,
  onSign,
  gitdir,
  ref,
  oid,
  note,
  force,
  author,
  committer,
  signingKey,
  repo,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  onSign?: SignCallback
  gitdir: string
  ref: string
  oid: string
  note: string | Uint8Array
  force?: boolean
  author: Author
  committer: Author
  signingKey?: string
  repo: Repository
}): Promise<string> {
  // Get the current note commit
  let parent: string | undefined
  try {
    parent = await resolveRef({ fs, gitdir, ref })
  } catch (err) {
    if (!(err instanceof NotFoundError)) {
      throw err
    }
  }

  // I'm using the "empty tree" magic number here for brevity
  const result = await _readTree({
    fs,
    cache,
    gitdir,
    oid: parent || '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
  })
  let tree = result.tree

  // Handle the case where a note already exists
  if (force) {
    tree = tree.filter(entry => entry.path !== oid)
  } else {
    for (const entry of tree) {
      if (entry.path === oid) {
        throw new AlreadyExistsError('note', oid)
      }
    }
  }

  // Create the note blob
  let noteBuffer: Uint8Array
  if (typeof note === 'string') {
    noteBuffer = Buffer.from(note, 'utf8')
  } else {
    noteBuffer = note
  }
  const noteOid = await writeObject({
    fs,
    gitdir,
    type: 'blob',
    object: noteBuffer,
    format: 'content',
  })
  if (!noteOid) {
    throw new Error('Failed to write note object')
  }

  // Create the new note tree
  tree.push({ mode: '100644', path: oid, oid: noteOid, type: 'blob' })
  const treeOid = await _writeTree({
    fs,
    gitdir,
    tree,
  })

  // Create the new note commit
  const commitOid = await _commit({
    fs,
    cache,
    gitdir,
    ref,
    tree: treeOid,
    parent: parent ? [parent] : undefined,
    onSign,
    message: `Note added by 'universal-git addNote'\n`,
    author,
    committer,
    signingKey,
    repo, // Pass Repository instance
  })

  return commitOid
}

