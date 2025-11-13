import { hasObjectLoose } from './hasObjectLoose.ts'
import { hasObjectPacked } from './hasObjectPacked.ts'
import { _readObject as readObject } from './readObject.ts'
import type { FsClient } from "../models/FileSystem.ts"

export async function hasObject({
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
  format?: string
}): Promise<boolean> {
  // Curry the current read method so that the packfile un-deltification
  // process can acquire external ref-deltas.
  const getExternalRefDelta = async (oid: string): Promise<{ type: string; object: Buffer }> => {
    const result = await readObject({ fs, cache, gitdir, oid })
    return {
      type: result.type || '',
      object: result.object,
    }
  }

  // Look for it in the loose object directory.
  let result = await hasObjectLoose({ fs, gitdir, oid })
  // Check to see if it's in a packfile.
  if (!result) {
    result = await hasObjectPacked({
      fs,
      cache,
      gitdir,
      oid,
      getExternalRefDelta,
    })
  }
  // Finally
  return result
}

