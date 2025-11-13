import { resolveObject } from './resolveObject.js'
import { parse as parseBlob } from '../core-utils/parsers/Blob.js'
import type { FsClient } from '../models/FileSystem.js'

export type ResolveBlobResult = {
  oid: string
  blob: Uint8Array
}

export async function resolveBlob({
  fs,
  cache,
  gitdir,
  oid,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
}): Promise<ResolveBlobResult> {
  const { oid: resolvedOid, object } = await resolveObject({
    fs,
    cache,
    gitdir,
    oid,
    expectedType: 'blob',
    parser: (buf) => new Uint8Array(parseBlob(buf)),
  })
  return { oid: resolvedOid, blob: object }
}

