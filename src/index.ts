import './typedefs.js'

import { STAGE } from './api/STAGE.ts'
import { TREE } from './api/TREE.ts'
import { WORKDIR } from './api/WORKDIR.ts'
import { abortMerge } from './api/abortMerge.ts'
import { add } from './api/add.ts'
import { addNote } from './api/addNote.ts'
import { addRemote } from './api/addRemote.ts'
import { annotatedTag } from './api/annotatedTag.ts'
import { branch } from './api/branch.ts'
import { checkout } from './api/checkout.ts'
import { clone } from './api/clone.ts'
import { commit } from './api/commit.ts'
import { currentBranch } from './api/currentBranch.ts'
import { deleteBranch } from './api/deleteBranch.ts'
import { deleteRef } from './api/deleteRef.ts'
import { deleteRemote } from './api/deleteRemote.ts'
import { deleteTag } from './api/deleteTag.ts'
import { expandOid } from './api/expandOid.ts'
import { expandRef } from './api/expandRef.ts'
import { fastForward } from './api/fastForward.ts'
import { fetch } from './api/fetch.ts'
import { findMergeBase } from './api/findMergeBase.ts'
import { findRoot } from './api/findRoot.ts'
import { getConfig } from './api/getConfig.ts'
import { getConfigAll } from './api/getConfigAll.ts'
import { getRemoteInfo } from './api/getRemoteInfo.ts'
import { getRemoteInfo2 } from './api/getRemoteInfo2.ts'
import { hashBlob } from './api/hashBlob.ts'
import { indexPack } from './api/indexPack.ts'
import { init } from './api/init.ts'
import { isDescendent } from './api/isDescendent.ts'
import { isIgnored } from './api/isIgnored.ts'
import { listBranches } from './api/listBranches.ts'
import { listFiles } from './api/listFiles.ts'
import { listNotes } from './api/listNotes.ts'
import { listRefs } from './api/listRefs.ts'
import { listRemotes } from './api/listRemotes.ts'
import { listServerRefs } from './api/listServerRefs.ts'
import { listTags } from './api/listTags.ts'
import { log } from './api/log.ts'
import { merge } from './api/merge.ts'
import { packObjects } from './api/packObjects.ts'
import { pull } from './api/pull.ts'
import { push } from './api/push.ts'
import { readBlob } from './api/readBlob.ts'
import { readCommit } from './api/readCommit.ts'
import { readNote } from './api/readNote.ts'
import { readObject } from './api/readObject.ts'
import { readTag } from './api/readTag.ts'
import { readTree } from './api/readTree.ts'
import { remove } from './api/remove.ts'
import { removeNote } from './api/removeNote.ts'
import { renameBranch } from './api/renameBranch.ts'
import { resetIndex } from './api/resetIndex.ts'
import { resetToCommit } from './api/reset.ts'
import { resolveRef } from './api/resolveRef.ts'
import { setConfig } from './api/setConfig.ts'
import { sparseCheckout } from './api/sparseCheckout.ts'
import { stash } from './api/stash.ts'
import { status } from './api/status.ts'
import { statusMatrix } from './api/statusMatrix.ts'
import { tag } from './api/tag.ts'
import { updateIndex } from './api/updateIndex.ts'
import { version } from './api/version.ts'
import { walk } from './api/walk.ts'
import { writeBlob } from './api/writeBlob.ts'
import { writeCommit } from './api/writeCommit.ts'
import { writeObject } from './api/writeObject.ts'
import { writeRef } from './api/writeRef.ts'
import { writeTag } from './api/writeTag.ts'
import { writeTree } from './api/writeTree.ts'
import * as Errors from './errors/index.ts'

// named exports
export {
  Errors,
  STAGE,
  TREE,
  WORKDIR,
  abortMerge,
  add,
  addNote,
  addRemote,
  annotatedTag,
  branch,
  checkout,
  clone,
  commit,
  getConfig,
  getConfigAll,
  setConfig,
  currentBranch,
  deleteBranch,
  deleteRef,
  deleteRemote,
  deleteTag,
  expandOid,
  expandRef,
  fastForward,
  fetch,
  findMergeBase,
  findRoot,
  getRemoteInfo,
  getRemoteInfo2,
  hashBlob,
  indexPack,
  init,
  isDescendent,
  isIgnored,
  listBranches,
  listFiles,
  listNotes,
  listRefs,
  listRemotes,
  listServerRefs,
  listTags,
  log,
  merge,
  packObjects,
  pull,
  push,
  readBlob,
  readCommit,
  readNote,
  readObject,
  readTag,
  readTree,
  remove,
  removeNote,
  renameBranch,
  resetIndex,
  resetToCommit,
  updateIndex,
  resolveRef,
  status,
  statusMatrix,
  sparseCheckout,
  tag,
  version,
  walk,
  writeBlob,
  writeCommit,
  writeObject,
  writeRef,
  writeTag,
  writeTree,
  stash,
}

// default export
export default {
  Errors,
  STAGE,
  TREE,
  WORKDIR,
  add,
  abortMerge,
  addNote,
  addRemote,
  annotatedTag,
  branch,
  checkout,
  clone,
  commit,
  getConfig,
  getConfigAll,
  setConfig,
  sparseCheckout,
  currentBranch,
  deleteBranch,
  deleteRef,
  deleteRemote,
  deleteTag,
  expandOid,
  expandRef,
  fastForward,
  fetch,
  findMergeBase,
  findRoot,
  getRemoteInfo,
  getRemoteInfo2,
  hashBlob,
  indexPack,
  init,
  isDescendent,
  isIgnored,
  listBranches,
  listFiles,
  listNotes,
  listRefs,
  listRemotes,
  listServerRefs,
  listTags,
  log,
  merge,
  packObjects,
  pull,
  push,
  readBlob,
  readCommit,
  readNote,
  readObject,
  readTag,
  readTree,
  remove,
  removeNote,
  renameBranch,
  resetIndex,
  resetToCommit,
  updateIndex,
  resolveRef,
  status,
  statusMatrix,
  sparseCheckout,
  tag,
  version,
  walk,
  writeBlob,
  writeCommit,
  writeObject,
  writeRef,
  writeTag,
  writeTree,
  stash,
}
