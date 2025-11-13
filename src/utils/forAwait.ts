import { getIterator } from './getIterator.js'

// Currently 'for await' upsets my linters.
export const forAwait = async <T>(
  iterable: AsyncIterable<T> | Iterable<T> | { next: () => IteratorResult<T> } | T,
  cb: (value: T) => Promise<void> | void
): Promise<void> => {
  const iter = getIterator(iterable)
  while (true) {
    const { value, done } = await iter.next()
    if (value) await cb(value)
    if (done) break
  }
  if (iter.return) await iter.return()
}

