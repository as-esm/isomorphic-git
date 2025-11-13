import { resolveObject } from './resolveObject.js'
import { parse as parseTree } from "../core-utils/parsers/Tree.ts"
import { GitTree } from "../models/GitTree.ts"
import type { FsClient } from "../models/FileSystem.ts"

export type ResolveTreeResult = {
  tree: ReturnType<typeof GitTree.from>
  oid: string
}

export async function resolveTree({
  fs,
  cache,
  gitdir,
  oid,
}: {
  fs: FsClient
  cache: Record<string, unknown>
  gitdir: string
  oid: string
}): Promise<ResolveTreeResult> {
  const { oid: resolvedOid, object } = await resolveObject({
    fs,
    cache,
    gitdir,
    oid,
    expectedType: 'tree',
    parser: (buf) => GitTree.from(parseTree(buf)),
    emptyTreeOid: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
  })
  return { tree: object, oid: resolvedOid }
}

