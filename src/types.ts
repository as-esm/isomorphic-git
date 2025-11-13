// ============================================================================
// TYPE RE-EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================================================
// This file re-exports types from their new decentralized locations.
// During the migration, all imports from '../types.js' will continue to work.
// After migration is complete, this file can be removed or kept minimal.

// Filesystem types
export type {
  CallbackFsClient,
  PromiseFsClient,
  FsClient,
  Stat,
} from './models/FileSystem.js'

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
} from './managers/GitRemoteHTTP.js'

// Git Object types
export type { ObjectType } from './models/GitObject.js'
export type { Author, CommitObject, ReadCommitResult } from './models/GitCommit.js'
export type { TagObject, ReadTagResult } from './models/GitAnnotatedTag.js'
export type { TreeEntry, TreeObject, ReadTreeResult } from './models/GitTree.js'

// Ref types
export type { ServerRef, ClientRef, RefUpdateStatus } from './managers/GitRefManager.js'

// Walker types
export type {
  Walker,
  WalkerEntry,
  WalkerMap,
  WalkerReduce,
  WalkerIterate,
  WalkerIterateCallback,
} from './models/Walker.js'

// Signing types
export type { SignParams, SignCallback } from './core-utils/Signing.js'

// Merge driver types
export type { MergeDriverParams, MergeDriverCallback } from './core-utils/algorithms/MergeManager.js'

// API operation result types
export type { MessageCallback, PrePushParams, PrePushCallback, PushResult } from './api/push.js'
export type { FetchResult } from './api/fetch.js'
export type { MergeResult } from './api/merge.js'
export type { CherryPickResult } from './api/cherryPick.js'
export type { RebaseResult } from './api/rebase.js'
export type { DiffEntry, DiffResult } from './api/diff.js'
export type { ShowResult } from './api/show.js'
export type { HeadStatus, WorkdirStatus, StageStatus, StatusRow } from './api/statusMatrix.js'
export type { PostCheckoutParams, PostCheckoutCallback } from './api/checkout.js'
export type { StashOp, StashChangeType } from './api/stash.js'
export type { ReadBlobResult } from './api/readBlob.js'
