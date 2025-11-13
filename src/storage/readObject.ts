import { InternalError } from '../errors/InternalError.js'
import { NotFoundError } from '../errors/NotFoundError.js'
import { GitObject } from "../models/GitObject.ts"
import { readObjectLoose } from './readObjectLoose.js'
import { readObjectPacked, type ReadObjectPackedResult } from './readObjectPacked.js'
import { inflate } from "../utils/inflate.ts"
import { shasum } from "../utils/shasum.ts"
import type { FsClient } from "../models/FileSystem.ts"

export type ReadObjectResult = {
  object: Buffer
  type?: string
  format: 'content' | 'wrapped' | 'deflated'
  source?: string
  oid?: string
}

export async function _readObject({
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
  format?: 'content' | 'wrapped' | 'deflated'
}): Promise<ReadObjectResult> {
  // Curry the current read method so that the packfile un-deltification
  // process can acquire external ref-deltas.
  const getExternalRefDelta = async (oid: string): Promise<{ type: string; object: Buffer }> => {
    const result = await _readObject({ fs, cache, gitdir, oid })
    return {
      type: result.type || '',
      object: result.object,
    }
  }

  let result: ReadObjectResult | null = null
  // Empty tree - hard-coded so we can use it as a shorthand.
  // Note: I think the canonical git implementation must do this too because
  // `git cat-file -t 4b825dc642cb6eb9a060e54bf8d69288fbee4904` prints "tree" even in empty repos.
  if (oid === '4b825dc642cb6eb9a060e54bf8d69288fbee4904') {
    result = { format: 'wrapped', object: Buffer.from(`tree 0\x00`) }
  }
  // Look for it in the loose object directory.
  if (!result) {
    result = await readObjectLoose({ fs, gitdir, oid })
  }
  // Check to see if it's in a packfile.
  if (!result) {
    const packedResult = await readObjectPacked({
      fs,
      cache,
      gitdir,
      oid,
      getExternalRefDelta,
    })

    if (!packedResult) {
      throw new NotFoundError(oid)
    }

    // Directly return packed result, as specified: packed objects always return the 'content' format.
    return {
      object: packedResult.object,
      type: packedResult.type,
      format: packedResult.format as 'content',
      source: packedResult.source,
      oid: packedResult.oid,
    }
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

  const sha = await shasum(result.object)
  if (sha !== oid) {
    throw new InternalError(
      `SHA check failed! Expected ${oid}, computed ${sha}`
    )
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

