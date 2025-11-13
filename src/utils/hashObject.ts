import { GitObject } from "../models/GitObject.ts"
import { shasum } from './shasum.js'

export const hashObject = async ({
  gitdir,
  type,
  object,
}: {
  gitdir?: string
  type: string
  object: Buffer | Uint8Array
}): Promise<string> => {
  return shasum(GitObject.wrap({ type, object }))
}

