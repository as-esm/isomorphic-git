import { forAwait } from './forAwait.ts'

export const collect = async (
  iterable: AsyncIterable<Uint8Array | Buffer> | Iterable<Uint8Array | Buffer>
): Promise<Uint8Array> => {
  const buffers: (Uint8Array | Buffer)[] = []
  // This will be easier once `for await ... of` loops are available.
  await forAwait(iterable, value => {
    buffers.push(value)
  })
  if (buffers.length === 0) {
    return new Uint8Array(0)
  }
  // Calculate total size using the actual array lengths
  let size = 0
  for (const buffer of buffers) {
    const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
    size += uint8Array.length
  }
  if (size === 0) {
    return new Uint8Array(0)
  }
  const result = new Uint8Array(size)
  let nextIndex = 0
  for (const buffer of buffers) {
    const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
    result.set(uint8Array, nextIndex)
    nextIndex += uint8Array.length
  }
  return result
}

