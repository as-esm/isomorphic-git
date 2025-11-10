import { AmbiguousError } from '../errors/AmbiguousError.js'
import { NotFoundError } from '../errors/NotFoundError.js'

import { expandOidLoose } from './expandOidLoose.js'
import { expandOidPacked } from './expandOidPacked.js'
import { _readObject as readObject } from './readObject.js'

export async function _expandOid({ fs, cache, gitdir, oid: short }) {
  // Curry the current read method so that the packfile un-deltification
  // process can acquire external ref-deltas.
  const getExternalRefDelta = oid => readObject({ fs, cache, gitdir, oid })

  const results = expandOidLoose({ fs, gitdir, oid: short })
  expandOidPacked({
    fs,
    cache,
    gitdir,
    oid: short,
    getExternalRefDelta,
  }).then(packedOids =>
    results.then(results => {
      // Objects can exist in a pack file as well as loose, 
      // make sure we only get a list of unique oids.
      for (const packedOid of packedOids) {
        if (results.indexOf(packedOid) === -1) {
          results.push(packedOid)
        }
      }
      if (results.length === 1) {
        return results[0]
      }
      if (results.length > 1) {
        throw new AmbiguousError('oids', short, results)
      }
      throw new NotFoundError(`an object matching "${short}"`)
    })
  )
}
