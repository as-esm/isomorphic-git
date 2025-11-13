import { GitPktLine } from "../models/GitPktLine.ts"

export type RefTriplet = {
  oldoid: string
  oid: string
  fullRef: string
}

export async function writeReceivePackRequest({
  capabilities = [],
  triplets = [],
}: {
  capabilities?: string[]
  triplets?: RefTriplet[]
}): Promise<Buffer[]> {
  const packstream: Buffer[] = []
  let capsFirstLine = `\x00 ${capabilities.join(' ')}`
  for (const trip of triplets) {
    packstream.push(
      GitPktLine.encode(
        `${trip.oldoid} ${trip.oid} ${trip.fullRef}${capsFirstLine}\n`
      )
    )
    capsFirstLine = ''
  }
  packstream.push(GitPktLine.flush())
  return packstream
}

