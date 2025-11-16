import { _addNote } from "../commands/addNote.ts"
import { MissingNameError } from "../errors/MissingNameError.ts"
import { normalizeFs } from "../utils/normalizeFs.ts"
import { assertParameter } from "../utils/assertParameter.ts"
import { join } from "../utils/join.ts"
import { normalizeAuthorObject } from "../utils/normalizeAuthorObject.ts"
import { normalizeCommitterObject } from "../utils/normalizeCommitterObject.ts"
import { Repository } from "../core-utils/Repository.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { SignCallback } from "../core-utils/Signing.ts"
import type { Author } from "../models/GitCommit.ts"

/**
 * Add or update an object note
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {SignCallback} [args.onSign] - a PGP signing implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.ref] - The notes ref to look under
 * @param {string} args.oid - The SHA-1 object id of the object to add the note to.
 * @param {string|Uint8Array} args.note - The note to add
 * @param {boolean} [args.force] - Over-write note if it already exists.
 * @param {Object} [args.author] - The details about the author.
 * @param {string} [args.author.name] - Default is `user.name` config.
 * @param {string} [args.author.email] - Default is `user.email` config.
 * @param {number} [args.author.timestamp=Math.floor(Date.now()/1000)] - Set the author timestamp field. This is the integer number of seconds since the Unix epoch (1970-01-01 00:00:00).
 * @param {number} [args.author.timezoneOffset] - Set the author timezone offset field. This is the difference, in minutes, from the current timezone to UTC. Default is `(new Date()).getTimezoneOffset()`.
 * @param {Object} [args.committer = author] - The details about the note committer, in the same format as the author parameter. If not specified, the author details are used.
 * @param {string} [args.committer.name] - Default is `user.name` config.
 * @param {string} [args.committer.email] - Default is `user.email` config.
 * @param {number} [args.committer.timestamp=Math.floor(Date.now()/1000)] - Set the committer timestamp field. This is the integer number of seconds since the Unix epoch (1970-01-01 00:00:00).
 * @param {number} [args.committer.timezoneOffset] - Set the committer timezone offset field. This is the difference, in minutes, from the current timezone to UTC. Default is `(new Date()).getTimezoneOffset()`.
 * @param {string} [args.signingKey] - Sign the note commit using this private PGP key.
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<string>} Resolves successfully with the SHA-1 object id of the commit object for the added note.
 */

export async function addNote({
  fs: _fs,
  onSign,
  dir,
  gitdir = dir ? join(dir, '.git') : undefined,
  ref = 'refs/notes/commits',
  oid,
  note,
  force,
  author: _author,
  committer: _committer,
  signingKey,
  cache = {},
}: {
  fs: FsClient
  onSign?: SignCallback
  dir?: string
  gitdir?: string
  ref?: string
  oid: string
  note: string | Uint8Array
  force?: boolean
  author?: Partial<Author>
  committer?: Partial<Author>
  signingKey?: string
  cache?: Record<string, unknown>
}): Promise<string> {
  try {
    assertParameter('fs', _fs)
    assertParameter('gitdir', gitdir)
    assertParameter('oid', oid)
    assertParameter('note', note)
    if (signingKey) {
      assertParameter('onSign', onSign)
    }
    const fs = normalizeFs(_fs)

    // CRITICAL: Use Repository to ensure state consistency
    const repo = await Repository.open({ fs: _fs, dir, gitdir, cache, autoDetectConfig: true })

    const author = await normalizeAuthorObject({ repo, author: _author })
    if (!author) throw new MissingNameError('author')

    const committer = await normalizeCommitterObject({
      repo,
      author,
      committer: _committer,
    })
    if (!committer) throw new MissingNameError('committer')

    return await _addNote({
      fs: fs as any,
      cache,
      onSign,
      gitdir: gitdir!,
      ref,
      oid,
      note,
      force,
      author,
      committer,
      signingKey,
      repo, // Pass Repository instance
    })
  } catch (err) {
    ;(err as { caller?: string }).caller = 'git.addNote'
    throw err
  }
}

