import { InternalError } from '../errors/InternalError.js'
import { NotFoundError } from '../errors/NotFoundError.js'
import { GitObject } from '../models/GitObject.js'
import { inflate } from '../utils/inflate.js'
import { shasum } from '../utils/shasum.js'

import { readObjectLoose } from './readObjectLoose.js'
import { readObjectPacked } from './readObjectPacked.js'

// TODO: this is a real ugly readObject implementation.

/**
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {string} args.gitdir
 * @param {string} args.oid
 * @param {string} [args.format]
 */
export function _readObject({ fs, cache, gitdir, oid, format = 'content' }) {
  // Curry the current read method so that the packfile un-deltification
  // process can acquire external ref-deltas.
  const getExternalRefDelta = oid => _readObject({ fs, cache, gitdir, oid })

  return Promise.resolve(
    // Empty tree - hard-coded so we can use it as a shorthand.
    // Note: I think the canonical git implementation must do this too because
    // `git cat-file -t 4b825dc642cb6eb9a060e54bf8d69288fbee4904` prints "tree" even in empty repos.
    oid === '4b825dc642cb6eb9a060e54bf8d69288fbee4904' && {
      format: 'wrapped',
      object: Buffer.from(`tree 0\x00`),
    }
  ) // @ts-expect-error Object loose definition is not complet
    .then(result => {
      return result || readObjectLoose({ fs, gitdir, oid })
    })
    .then(result => {
      // Directly return packed result, as specified: packed objects always return the 'content' format.
      // TODO: check with end of function where we add a type property that this would not have.
      return (
        result ||
        readObjectPacked({
          fs,
          cache,
          gitdir,
          oid,
          getExternalRefDelta,
        })
      )
    })
    .then(result => result || Promise.reject(new NotFoundError(oid)))
    .then(result => {
      // Loose objects are always deflated, return early
      return format === 'deflated'
        ? result
        : result.format === 'deflated'
        ? // All loose objects are deflated but the hard-coded empty tree is `wrapped`
          // so we have to check if we need to inflate the object.
          inflate(result.object)
            .then(Buffer.from)
            .then(object => ({ format: 'wrapped', object }))
        : shasum(result.object)
            .then(sha => {
              if (sha !== oid) {
                return Promise.reject(
                  new InternalError(
                    `SHA check failed! Expected ${oid}, computed ${sha}`
                  )
                )
              }
              return result
            })
            .then(result => {
              const { object, type } = GitObject.unwrap(result.object)

              if (format === 'content') {
                return {
                  type,
                  object,
                  format,
                }
              }
              return Promise.reject(
                new InternalError(`invalid requested format "${format}"`)
              )
            })
    })
}
