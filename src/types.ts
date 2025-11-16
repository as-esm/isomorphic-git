// ============================================================================
// TYPE RE-EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================================================
// This file re-exports types from their new decentralized locations.
// During the migration, all imports from '../types.ts' will continue to work.
// After migration is complete, this file can be removed or kept minimal.

// Filesystem types
export type {
  CallbackFsClient,
  PromiseFsClient,
  FsClient,
  Stat,
} from "./models/FileSystem.ts"

// HTTP and Auth types
export type {
  GitProgressEvent,
  ProgressCallback,
  GitHttpRequest,
  GitHttpResponse,
  HttpFetch,
  HttpClient,
  GitAuth,
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
} from "./managers/GitRemoteHTTP.ts"

// Git Object types
export type { ObjectType } from "./models/GitObject.ts"
export type { Author, CommitObject, ReadCommitResult } from "./models/GitCommit.ts"
export type { TagObject, ReadTagResult } from "./models/GitAnnotatedTag.ts"
export type { TreeEntry, TreeObject, ReadTreeResult } from "./models/GitTree.ts"

// Ref types
export type { ServerRef, ClientRef, RefUpdateStatus } from "./git/refs/types.ts"

// Walker types
export type {
  Walker,
  WalkerEntry,
  WalkerMap,
  WalkerReduce,
  WalkerIterate,
  WalkerIterateCallback,
} from "./models/Walker.ts"

// Signing types
export type { SignParams, SignCallback } from "./core-utils/Signing.ts"

// Merge driver types
export type { MergeDriverParams, MergeDriverCallback } from "./core-utils/algorithms/MergeManager.ts"

// API operation result types
export type { MessageCallback, PrePushParams, PrePushCallback, PushResult } from './commands/push.ts'
export type { FetchResult } from './commands/fetch.ts'
export type { MergeResult } from './commands/merge.ts'
export type { CherryPickResult } from './api/cherryPick.ts'
export type { RebaseResult } from './api/rebase.ts'
export type { DiffEntry, DiffResult } from './commands/diff.ts'
export type { ShowResult } from './commands/show.ts'
export type { HeadStatus, WorkdirStatus, StageStatus, StatusRow } from './commands/statusMatrix.ts'
export type { FileStatus } from './commands/status.ts'
export type { PostCheckoutParams, PostCheckoutCallback } from './commands/checkout.ts'
export type { StashOp, StashChangeType } from './api/stash.ts'
export type { ReadBlobResult } from './commands/readBlob.ts'
