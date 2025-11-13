import cleanGitRef from 'clean-git-ref'

import { _currentBranch } from "../commands/currentBranch.ts"
import { AlreadyExistsError } from '../errors/AlreadyExistsError.ts'
import { InvalidRefNameError } from '../errors/InvalidRefNameError.ts'
import { GitRefManager } from "../managers/GitRefManager.ts"
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

  const newexist = await GitRefManager.exists({ fs, gitdir, ref: fullnewref })

  if (newexist) {
    throw new AlreadyExistsError('branch', ref, false)
  }

  const value = await GitRefManager.resolve({
    fs,
    gitdir,
    ref: fulloldref,
    depth: 1,
  })

  await GitRefManager.writeRef({ fs, gitdir, ref: fullnewref, value })
  await GitRefManager.deleteRef({ fs, gitdir, ref: fulloldref })

  const fullCurrentBranchRef = await _currentBranch({
    fs,
    gitdir,
    fullname: true,
  })
  const isCurrentBranch = fullCurrentBranchRef === fulloldref

  if (checkout || isCurrentBranch) {
    // Update HEAD
    await GitRefManager.writeSymbolicRef({
      fs,
      gitdir,
      ref: 'HEAD',
      value: fullnewref,
    })
  }
}

