/**
 * @deprecated Use `readObject` from 'isomorphic-git/commands' instead
 * This file is kept for backward compatibility and will be removed in a future version.
 */
export type {
  DeflatedObject,
  WrappedObject,
  RawObject,
  ParsedBlobObject,
  ParsedCommitObject,
  ParsedTreeObject,
  ParsedTagObject,
  ParsedObject,
  ReadObjectResult,
} from '../commands/readObject.ts'
export { readObject } from '../commands/readObject.ts'

