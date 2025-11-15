import cleanGitRef from 'clean-git-ref'

import { _currentBranch } from "../commands/currentBranch.ts"
import { AlreadyExistsError } from '../errors/AlreadyExistsError.ts'
import { InvalidRefNameError } from '../errors/InvalidRefNameError.ts'
import { resolveRef } from "../git/refs/readRef.ts"
import { writeRef, writeSymbolicRef } from "../git/refs/writeRef.ts"
import { deleteRefs } from "../git/refs/deleteRef.ts"
import { NotFoundError } from "../errors/NotFoundError.ts"
import validRef from "../utils/isValidRef.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * Rename a branch
 *
 * @param {object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {string} args.ref - The name of the new branch
 * @param {string} args.oldref - The name of the old branch
 * @param {boolean} [args.checkout = false]
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 */
export async function _renameBranch({
  fs,
  gitdir,
  oldref,
  ref,
  checkout = false,
}: {
  fs: FsClient
  gitdir: string
  oldref: string
  ref: string
  checkout?: boolean
}): Promise<void> {
  if (!validRef(ref, true)) {
    throw new InvalidRefNameError(ref, cleanGitRef.clean(ref))
  }

  if (!validRef(oldref, true)) {
    throw new InvalidRefNameError(oldref, cleanGitRef.clean(oldref))
  }

  const fulloldref = `refs/heads/${oldref}`
  const fullnewref = `refs/heads/${ref}`

  // Check if new branch already exists
  try {
    await resolveRef({ fs, gitdir, ref: fullnewref })
    throw new AlreadyExistsError('branch', ref, false)
  } catch (err) {
    if (err instanceof AlreadyExistsError) throw err
    // NotFoundError means branch doesn't exist, which is fine
    if (!(err instanceof NotFoundError)) throw err
  }

  const value = await resolveRef({
    fs,
    gitdir,
    ref: fulloldref,
    depth: 1,
  })

  await writeRef({ fs, gitdir, ref: fullnewref, value })
  await deleteRefs({ fs, gitdir, refs: [fulloldref] })

  const fullCurrentBranchRef = await _currentBranch({
    fs,
    gitdir,
    fullname: true,
  })
  const isCurrentBranch = fullCurrentBranchRef === fulloldref

  if (checkout || isCurrentBranch) {
    // Update HEAD
    await writeSymbolicRef({
      fs,
      gitdir,
      ref: 'HEAD',
      value: fullnewref,
    })
  }
}

