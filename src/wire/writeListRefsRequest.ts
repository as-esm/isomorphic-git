import { GitPktLine } from "../models/GitPktLine.ts"
import { pkg } from "../utils/pkg.ts"

export async function writeListRefsRequest({
  prefix,
  symrefs = false,
  peelTags = false,
}: {
  prefix?: string
  symrefs?: boolean
  peelTags?: boolean
}): Promise<Buffer[]> {
  const packstream: Buffer[] = []
  // command
  packstream.push(GitPktLine.encode('command=ls-refs\n'))
  // capability-list
  packstream.push(GitPktLine.encode(`agent=${pkg.agent}\n`))
  // [command-args]
  if (peelTags || symrefs || prefix) {
    packstream.push(GitPktLine.delim())
  }
  if (peelTags) packstream.push(GitPktLine.encode('peel'))
  if (symrefs) packstream.push(GitPktLine.encode('symrefs'))
  if (prefix) packstream.push(GitPktLine.encode(`ref-prefix ${prefix}`))
  packstream.push(GitPktLine.flush())
  return packstream
}

