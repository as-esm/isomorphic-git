import { _currentBranch } from "../commands/currentBranch.ts"
import { NotFoundError } from '../errors/NotFoundError.ts'
import { RefManager } from "../core-utils/refs/RefManager.ts"
import { parse as parseConfig, serialize as serializeConfig } from "../core-utils/ConfigParser.ts"
import { abbreviateRef } from "../utils/abbreviateRef.ts"
import { join } from "../utils/join.ts"
import type { FsClient } from "../models/FileSystem.ts"

/**
 * @param {Object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {string} args.gitdir
 * @param {string} args.ref
 *
 * @returns {Promise<void>}
 */
export async function _deleteBranch({ fs, gitdir, ref }: { fs: FsClient; gitdir: string; ref: string }): Promise<void> {
  ref = ref.startsWith('refs/heads/') ? ref : `refs/heads/${ref}`
  try {
    await RefManager.resolve({ fs, gitdir, ref })
  } catch (e) {
    throw new NotFoundError(ref)
  }

  const currentRef = await _currentBranch({ fs, gitdir, fullname: true })
  if (ref === currentRef) {
    // detach HEAD
    const value = await RefManager.resolve({ fs, gitdir, ref })
    await RefManager.writeRef({ fs, gitdir, ref: 'HEAD', value })
  }

  // Delete a specified branch
  await RefManager.deleteRef({ fs, gitdir, ref })

  // Delete branch config entries
  const abbrevRef = abbreviateRef(ref)
  let configBuffer = Buffer.alloc(0)
  try {
    configBuffer = await fs.read(join(gitdir, 'config'))
  } catch (err) {
    // Config doesn't exist
    return
  }
  const config = parseConfig(configBuffer)
  config.deleteSection('branch', abbrevRef)
  const updatedConfig = serializeConfig(config)
  await fs.write(join(gitdir, 'config'), updatedConfig)
}

