import { InternalError } from '../errors/InternalError.js'
import { join } from '../utils/join.js'

import { readPackIndex } from './readPackIndex.js'

export async function hasObjectPacked({
  fs,
  cache,
  gitdir,
  oid,
  getExternalRefDelta,
}) {
  // Check to see if it's in a packfile.
  // Iterate through all the .idx files
  let list = await fs.readdir(join(gitdir, 'objects/pack'))
  list = list.filter(x => x.endsWith('.idx'))
  for (const filename of list) {
    const indexFile = `${gitdir}/objects/pack/${filename}`
    const p = await readPackIndex({
      fs,
      cache,
      filename: indexFile,
      getExternalRefDelta,
      emitter: undefined,
      emitterPrefix: undefined,
    })
    if (p.error) throw new InternalError(p.error)
    // If the packfile DOES have the oid we're looking for...
    if (p.offsets.has(oid)) {
      return true
    }
  }
  // Failed to find it
  return false
}
