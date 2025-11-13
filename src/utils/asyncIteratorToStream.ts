import { forAwait } from './forAwait.ts'

export function asyncIteratorToStream<T>(iter: AsyncIterable<T> | Iterable<T>): any {
  const { PassThrough } = require('readable-stream')
  const stream = new PassThrough()
  setTimeout(async () => {
    await forAwait(iter, (chunk: T) => stream.write(chunk))
    stream.end()
  }, 1)
  return stream
}

