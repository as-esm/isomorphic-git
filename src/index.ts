import './typedefs.js'

import { STAGE } from './api/STAGE.ts'
import { TREE } from './api/TREE.ts'
import { WORKDIR } from './api/WORKDIR.ts'
import { abortMerge } from './commands/abortMerge.ts'
import { add } from './commands/add.ts'
import { addNote } from './api/addNote.ts'
import { addRemote } from './commands/addRemote.ts'
import { annotatedTag } from './commands/annotatedTag.ts'
import { branch } from './api/branch.ts'
import { checkout } from './commands/checkout.ts'
import { clone } from './api/clone.ts'
import { commit } from './commands/commit.ts'
import { currentBranch } from './api/currentBranch.ts'
import { deleteBranch } from './api/deleteBranch.ts'
import { deleteRef } from './api/deleteRef.ts'
import { deleteRemote } from './commands/deleteRemote.ts'
import { deleteTag } from './api/deleteTag.ts'
import { expandOid } from './commands/expandOid.ts'
import { expandRef } from './commands/expandRef.ts'
import { fastForward } from './api/fastForward.ts'
import { fetch } from './commands/fetch.ts'
import { findMergeBase } from './api/findMergeBase.ts'
import { findRoot } from './commands/findRoot.ts'
import { getConfig } from './commands/getConfig.ts'
import { getConfigAll } from './commands/getConfigAll.ts'
import { getRemoteInfo } from './commands/getRemoteInfo.ts'
import { getRemoteInfo2 } from './commands/getRemoteInfo2.ts'
import { hashBlob } from './commands/hashBlob.ts'
import { indexPack } from './api/indexPack.ts'
import { init } from './commands/init.ts'
import { isDescendent } from './api/isDescendent.ts'
import { isIgnored } from './api/isIgnored.ts'
import { listBranches } from './commands/listBranches.ts'
import { listFiles } from './commands/listFiles.ts'
import { listNotes } from './commands/listNotes.ts'
import { listRefs } from './commands/listRefs.ts'
import { listRemotes } from './commands/listRemotes.ts'
import { listServerRefs } from './commands/listServerRefs.ts'
import { listTags } from './commands/listTags.ts'
import { log } from './commands/log.ts'
import { merge } from './api/merge.ts'
import { packObjects } from './api/packObjects.ts'
import { pull } from './api/pull.ts'
import { push } from './commands/push.ts'
import { readBlob } from './commands/readBlob.ts'
import { readCommit } from './commands/readCommit.ts'
import { readNote } from './commands/readNote.ts'
import { readObject } from './commands/readObject.ts'
import { readTag } from './commands/readTag.ts'
import { readTree } from './commands/readTree.ts'
import { remove } from './commands/remove.ts'
import { removeNote } from './commands/removeNote.ts'
import { renameBranch } from './api/renameBranch.ts'
import { resetIndex } from './commands/resetIndex.ts'
import { resetToCommit } from './commands/reset.ts'
import { resolveRef } from './commands/resolveRef.ts'
import { setConfig } from './commands/setConfig.ts'
import { sparseCheckout } from './api/sparseCheckout.ts'
import { stash } from './commands/stash.ts'
import { status } from './commands/status.ts'
import { statusMatrix } from './commands/statusMatrix.ts'
import { tag } from './commands/tag.ts'
import { updateIndex } from './commands/updateIndex.ts'
import { version } from './api/version.ts'
import { walk } from './api/walk.ts'
import { writeBlob } from './commands/writeBlob.ts'
import { writeCommit } from './commands/writeCommit.ts'
import { writeObject } from './commands/writeObject.ts'
import { writeRef } from './commands/writeRef.ts'
import { writeTag } from './commands/writeTag.ts'
import { writeTree } from './commands/writeTree.ts'
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
