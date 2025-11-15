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
export type { MessageCallback, PrePushParams, PrePushCallback, PushResult } from './api/push.ts'
export type { FetchResult } from './api/fetch.ts'
export type { MergeResult } from './api/merge.ts'
export type { CherryPickResult } from './api/cherryPick.ts'
export type { RebaseResult } from './api/rebase.ts'
export type { DiffEntry, DiffResult } from './api/diff.ts'
export type { ShowResult } from './api/show.ts'
export type { HeadStatus, WorkdirStatus, StageStatus, StatusRow } from './api/statusMatrix.ts'
export type { PostCheckoutParams, PostCheckoutCallback } from './api/checkout.ts'
export type { StashOp, StashChangeType } from './api/stash.ts'
export type { ReadBlobResult } from './api/readBlob.ts'
