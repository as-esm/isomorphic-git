import { fromValue } from './fromValue.ts'

export const getIterator = <T>(
  iterable: AsyncIterable<T> | Iterable<T> | { next: () => IteratorResult<T> } | T
): AsyncIterator<T> => {
  if (iterable && typeof iterable === 'object' && Symbol.asyncIterator in iterable) {
    return (iterable as AsyncIterable<T>)[Symbol.asyncIterator]()
  }
  if (iterable && typeof iterable === 'object' && Symbol.iterator in iterable) {
    return (iterable as Iterable<T>)[Symbol.iterator]() as AsyncIterator<T>
  }
  if (iterable && typeof iterable === 'object' && 'next' in iterable) {
    return iterable as AsyncIterator<T>
  }
  return fromValue(iterable)
}

