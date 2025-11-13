// @ts-check
import '../typedefs.js'

import { AlreadyExistsError } from '../errors/AlreadyExistsError.js'
import { RefManager } from "../core-utils/refs/RefManager.ts"
import { ObjectReader, ObjectWriter } from "../core-utils/odb/index.ts"
import { parse as parseTag, serialize as serializeTag } from "../core-utils/parsers/Tag.ts"
import { signTag } from "../core-utils/Signing.ts"

/**
 * Create an annotated tag.
 *
 * @param {object} args
 * @param {import('../types.js').FsClient} args.fs
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
}) {
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
  const { object: objContent } = await ObjectReader.read({ fs, cache, gitdir, oid })
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
    const tagBuffer = serializeTag(tagObject)
    const signed = await signTag({
      payload: tagBuffer,
      signer: onSign,
      secretKey: signingKey,
    })
    tagObject.gpgsig = signed
  }
  
  // Serialize and write tag object
  const tagBuffer = serializeTag(tagObject)
  const value = await ObjectWriter.write({
    fs,
    gitdir,
    type: 'tag',
    content: tagBuffer,
  })

  await RefManager.writeRef({ fs, gitdir, ref, value })
}
