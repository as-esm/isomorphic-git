import { resolveObject } from './resolveObject.js'
import { parse as parseCommit } from '../core-utils/parsers/Commit.js'
import { GitCommit } from '../models/GitCommit.js'
import type { FsClient } from '../models/FileSystem.js'

export type ResolveCommitResult = {
  commit: ReturnType<typeof GitCommit.from>
  oid: string
}

export async function resolveCommit({
  fs,
  cache,
  gitdir,
  oid,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
}): Promise<ResolveCommitResult> {
  const { oid: resolvedOid, object } = await resolveObject({
    fs,
    cache,
    gitdir,
    oid,
    expectedType: 'commit',
    parser: (buf) => GitCommit.from(parseCommit(buf)),
  })
  return { commit: object, oid: resolvedOid }
}

