import { join } from '../../core-utils/GitPath.ts'
import type { FsClient } from "../../models/FileSystem.ts"

/**
 * Reads MERGE_MODE
 */
export const readMergeMode = async ({
  fs,
  gitdir,
}: {
  fs: FsClient
  gitdir: string
}): Promise<string | null> => {
  try {
    const content = await fs.read(join(gitdir, 'MERGE_MODE'), 'utf8')
    return (content as string).trim()
  } catch (err) {
    if ((err as { code?: string }).code === 'NOENT') {
      return null
    }
    throw err
  }
}

/**
 * Writes MERGE_MODE
 */
export const writeMergeMode = async ({
  fs,
  gitdir,
  mode,
}: {
  fs: FsClient
  gitdir: string
  mode: string
}): Promise<void> => {
  await fs.write(join(gitdir, 'MERGE_MODE'), `${mode}\n`, 'utf8')
}

