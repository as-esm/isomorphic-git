import { forAwait } from './forAwait.js'

export const collect = async (
  iterable: AsyncIterable<Uint8Array | Buffer> | Iterable<Uint8Array | Buffer>
): Promise<Uint8Array> => {
  let size = 0
  const buffers: (Uint8Array | Buffer)[] = []
  // This will be easier once `for await ... of` loops are available.
  await forAwait(iterable, value => {
    buffers.push(value)
    size += value.byteLength
  })
  const result = new Uint8Array(size)
  let nextIndex = 0
  for (const buffer of buffers) {
    const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
    result.set(uint8Array, nextIndex)
    nextIndex += buffer.byteLength
  }
  return result
}

