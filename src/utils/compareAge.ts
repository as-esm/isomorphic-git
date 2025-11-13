import type { CommitObject } from '../models/GitCommit.js'

export const compareAge = (a: CommitObject, b: CommitObject): number => {
  return a.committer.timestamp - b.committer.timestamp
}

