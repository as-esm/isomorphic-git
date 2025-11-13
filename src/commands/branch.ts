import cleanGitRef from 'clean-git-ref'

import { AlreadyExistsError } from '../errors/AlreadyExistsError.ts'
import { InvalidRefNameError } from '../errors/InvalidRefNameError.ts'
import { RefManager } from "../core-utils/refs/RefManager.ts"
import { appendReflog } from "../core-utils/refs/ReflogManager.ts"
import validRef from "../utils/isValidRef.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Create a branch
 *
 * @param {object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {string} args.ref
 * @param {string} [args.object = 'HEAD']
 * @param {boolean} [args.checkout = false]
 * @param {boolean} [args.force = false]
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.branch({ dir: '$input((/))', ref: '$input((develop))' })
 * console.log('done')
 *
 */
export async function _branch({
  fs,
  gitdir,
  ref,
  object,
  checkout = false,
  force = false,
}: {
  fs: FsClient
  gitdir: string
  ref: string
  object?: string
  checkout?: boolean
  force?: boolean
}): Promise<void> {
  if (!validRef(ref, true)) {
    throw new InvalidRefNameError(ref, cleanGitRef.clean(ref))
  }

  const fullref = `refs/heads/${ref}`

  if (!force) {
    try {
      await RefManager.resolve({ fs, gitdir, ref: fullref })
      // Branch exists
      throw new AlreadyExistsError('branch', ref, false)
    } catch (e) {
      if (e instanceof AlreadyExistsError) throw e
      // Branch doesn't exist, that's fine
    }
  }

  // Get current HEAD tree oid
  let oid: string | undefined
  try {
    oid = await RefManager.resolve({ fs, gitdir, ref: object || 'HEAD' })
  } catch (e) {
    // Probably an empty repo
  }

  // Create a new ref that points at the current commit
  if (oid) {
    const oldOid = '0000000000000000000000000000000000000000' // New branch
    await RefManager.writeRef({ fs, gitdir, ref: fullref, value: oid })
    
    // Write reflog entry
    const author = 'isomorphic-git <noreply@isomorphic-git.org>'
    const timestamp = Math.floor(Date.now() / 1000)
    const timezoneOffset = new Date().getTimezoneOffset()
    const offsetStr = `${timezoneOffset > 0 ? '-' : '+'}${Math.abs(Math.floor(timezoneOffset / 60)).toString().padStart(2, '0')}${Math.abs(timezoneOffset % 60).toString().padStart(2, '0')}`
    await appendReflog({
      fs,
      gitdir,
      ref: fullref,
      entry: {
        oldOid,
        newOid: oid,
        author,
        timestamp,
        timezoneOffset: offsetStr,
        message: `branch: Created from ${object || 'HEAD'}`,
      },
    })
  }

  if (checkout) {
    // Update HEAD
    await RefManager.writeSymbolicRef({
      fs,
      gitdir,
      ref: 'HEAD',
      value: fullref,
    })
  }
}

