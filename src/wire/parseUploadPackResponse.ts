import { InvalidOidError } from "../errors/InvalidOidError.ts"
import { GitSideBand } from "../models/GitSideBand.ts"
import { forAwait } from "../utils/forAwait.ts"
import type { FIFO } from "../utils/FIFO.ts"

export type ParseUploadPackResponseResult = {
  shallows: string[]
  unshallows: string[]
  acks: Array<{ oid: string; status?: string }>
  nak: boolean
  packfile: FIFO
  progress: FIFO
}

export async function parseUploadPackResponse(stream: AsyncIterableIterator<Uint8Array>): Promise<ParseUploadPackResponseResult> {
  const { packetlines, packfile, progress } = GitSideBand.demux(stream)
  const shallows: string[] = []
  const unshallows: string[] = []
  const acks: Array<{ oid: string; status?: string }> = []
  let nak = false
  let done = false
  return new Promise<ParseUploadPackResponseResult>((resolve, reject) => {
    // Parse the response
    forAwait(packetlines as unknown as AsyncIterable<Buffer>, async (data: Buffer) => {
      const line = data.toString('utf8').trim()
      if (line.startsWith('shallow')) {
        const oid = line.slice(-41).trim()
        if (oid.length !== 40) {
          reject(new InvalidOidError(oid))
          return
        }
        shallows.push(oid)
      } else if (line.startsWith('unshallow')) {
        const oid = line.slice(-41).trim()
        if (oid.length !== 40) {
          reject(new InvalidOidError(oid))
          return
        }
        unshallows.push(oid)
      } else if (line.startsWith('ACK')) {
        const parts = line.split(' ')
        const oid = parts[1]
        const status = parts[2]
        if (oid) {
          acks.push({ oid, status })
        }
        if (!status) done = true
      } else if (line.startsWith('NAK')) {
        nak = true
        done = true
      } else {
        done = true
        nak = true
      }
      if (done) {
        const streamAny = stream as any
        streamAny.error
          ? reject(streamAny.error)
          : resolve({ shallows, unshallows, acks, nak, packfile, progress })
      }
    }).finally(() => {
      if (!done) {
        const streamAny = stream as any
        streamAny.error
          ? reject(streamAny.error)
          : resolve({ shallows, unshallows, acks, nak, packfile, progress })
      }
    })
  })
}

