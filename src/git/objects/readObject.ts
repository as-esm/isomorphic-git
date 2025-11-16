import { InternalError } from "../../errors/InternalError.ts"
import { NotFoundError } from "../../errors/NotFoundError.ts"
import { GitObject } from "../../models/GitObject.ts"
import { read as readLoose } from './loose.ts'
import { read as readPacked } from './pack.ts'
import { shasum } from '../../core-utils/ShaHasher.ts'
import { inflate } from '../../core-utils/Zlib.ts'
import type { FsClient } from "../../models/FileSystem.ts"

export type ReadResult = {
  type: string
  object: Buffer
  format: string
  source?: string
}

export type ObjectFormat = 'deflated' | 'wrapped' | 'content'

/**
 * High-level facade for reading objects from both loose and packed object stores
 * 
 * @param fs - File system client
 * @param cache - Cache object for packfile indices
 * @param gitdir - Path to .git directory
 * @param oid - Object ID (SHA-1)
 * @param format - Format to return object in ('deflated', 'wrapped', or 'content')
 * @returns Promise resolving to the read object result
 */
export async function readObject({
  fs,
  cache,
  gitdir,
  oid,
  format = 'content',
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
  format?: ObjectFormat
}): Promise<ReadResult> {
  // Curry the current read method so that the packfile un-deltification
  // process can acquire external ref-deltas.
  const getExternalRefDelta = (oid: string): Promise<ReadResult> =>
    readObject({ fs, cache, gitdir, oid, format: 'content' })

  let result: ReadResult | null = null

  // Empty tree - hard-coded so we can use it as a shorthand.
  // Note: I think the canonical git implementation must do this too because
  // `git cat-file -t 4b825dc642cb6eb9a060e54bf8d69288fbee4904` prints "tree" even in empty repos.
  if (oid === '4b825dc642cb6eb9a060e54bf8d69288fbee4904') {
    result = { format: 'wrapped', object: Buffer.from(`tree 0\x00`), type: 'tree' }
  }

  // Look for it in the loose object directory.
  if (!result) {
    result = await readLoose({ fs, gitdir, oid, format })
  }

  // Check to see if it's in a packfile.
  if (!result) {
    result = await readPacked({
      fs,
      cache,
      gitdir,
      oid,
      format,
      getExternalRefDelta,
    })

    if (!result) {
      throw new NotFoundError(oid)
    }

    // Directly return packed result, as specified: packed objects always return the 'content' format.
    return result
  }

  // Loose objects are always deflated, return early
  if (format === 'deflated') {
    return result
  }

  // All loose objects are deflated but the hard-coded empty tree is `wrapped` so we have to check if we need to inflate the object.
  if (result.format === 'deflated') {
    result.object = Buffer.from(await inflate(result.object))
    result.format = 'wrapped'
  }

  if (format === 'wrapped') {
    return result
  }

  // Verify SHA and unwrap
  const sha = await shasum(result.object)
  if (sha !== oid) {
    throw new InternalError(`SHA check failed! Expected ${oid}, computed ${sha}`)
  }
  const { object, type } = GitObject.unwrap(result.object)
  result.type = type
  result.object = object
  result.format = 'content'

  if (format === 'content') {
    return result
  }

  throw new InternalError(`invalid requested format "${format}"`)
}

