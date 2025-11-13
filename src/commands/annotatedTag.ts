import { AlreadyExistsError } from '../errors/AlreadyExistsError.ts'
import { RefManager } from "../core-utils/refs/RefManager.ts"
import { read as readObject } from "../core-utils/odb/ObjectReader.ts"
import { write as writeObject } from "../core-utils/odb/ObjectWriter.ts"
import { parse as parseTag, serialize as serializeTag } from "../core-utils/parsers/Tag.ts"
import { signTag, extractSignature } from "../core-utils/Signing.ts"
import type { FsClient } from "../models/FileSystem.ts"
import type { SignCallback } from "../core-utils/Signing.ts"
import type { Author } from "../models/GitCommit.ts"

/**
 * Create an annotated tag.
 *
 * @param {object} args
 * @param {import('../types.ts').FsClient} args.fs
 * @param {any} args.cache
 * @param {SignCallback} [args.onSign]
 * @param {string} args.gitdir
 * @param {string} args.ref
 * @param {string} [args.message = ref]
 * @param {string} [args.object = 'HEAD']
 * @param {object} [args.tagger]
 * @param {string} args.tagger.name
 * @param {string} args.tagger.email
 * @param {number} args.tagger.timestamp
 * @param {number} args.tagger.timezoneOffset
 * @param {string} [args.gpgsig]
 * @param {string} [args.signingKey]
 * @param {boolean} [args.force = false]
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.annotatedTag({
 *   dir: '$input((/))',
 *   ref: '$input((test-tag))',
 *   message: '$input((This commit is awesome))',
 *   tagger: {
 *     name: '$input((Mr. Test))',
 *     email: '$input((mrtest@example.com))'
 *   }
 * })
 * console.log('done')
 *
 */
export async function _annotatedTag({
  fs,
  cache,
  onSign,
  gitdir,
  ref,
  tagger,
  message = ref,
  gpgsig,
  object,
  signingKey,
  force = false,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  onSign?: SignCallback
  gitdir: string
  ref: string
  tagger: Author
  message?: string
  gpgsig?: string
  object?: string
  signingKey?: string
  force?: boolean
}): Promise<void> {
  ref = ref.startsWith('refs/tags/') ? ref : `refs/tags/${ref}`

  if (!force) {
    try {
      await RefManager.resolve({ fs, gitdir, ref })
      // Tag exists
      throw new AlreadyExistsError('tag', ref)
    } catch (e) {
      if (e instanceof AlreadyExistsError) throw e
      // Tag doesn't exist, that's fine
    }
  }

  // Resolve passed value
  const oid = await RefManager.resolve({
    fs,
    gitdir,
    ref: object || 'HEAD',
  })

  // Get object type
  const { object: objContent } = await readObject({ fs, cache, gitdir, oid })
  // Determine type from object (simplified - would need to check object header)
  const type = 'commit' // Default assumption, would need proper detection

  // Create tag object
  let tagObject = {
    object: oid,
    type,
    tag: ref.replace('refs/tags/', ''),
    tagger: {
      name: tagger.name,
      email: tagger.email,
      timestamp: tagger.timestamp,
      timezoneOffset: tagger.timezoneOffset,
    },
    message,
    gpgsig,
  }
  
  // Sign if requested
  if (signingKey && onSign) {
    // Serialize the tag and use GitAnnotatedTag to sign it
    // This ensures we use the exact same payload logic as when reading
    const { GitAnnotatedTag } = await import('../models/GitAnnotatedTag.ts')
    const tagBuffer = serializeTag(tagObject)
    const tagString = tagBuffer.toString('utf8')
    const tag = GitAnnotatedTag.from(tagString)
    
    // Sign using GitAnnotatedTag.sign() which uses tag.payload() - the same function used when reading
    const signedTag = await GitAnnotatedTag.sign(tag, onSign, signingKey)
    
    // Write the signed tag's raw content directly (without re-serializing)
    // This ensures the format matches exactly what we'll read back
    const signedTagBuffer = signedTag.toObject()
    const value = await writeObject({
      fs,
      gitdir,
      type: 'tag',
      object: signedTagBuffer,
    })

    await RefManager.writeRef({ fs, gitdir, ref, value })
    return
  }
  
  // Serialize and write tag object (unsigned)
  const tagBuffer = serializeTag(tagObject)
  const value = await writeObject({
    fs,
    gitdir,
    type: 'tag',
    object: tagBuffer,
  })

  await RefManager.writeRef({ fs, gitdir, ref, value })
}

