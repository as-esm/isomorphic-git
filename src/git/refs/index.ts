/**
 * Git Refs Operations
 * Direct operations on .git/refs/ directory
 * 
 * References (refs) are files that point to commit OIDs or other refs.
 * This module provides direct read/write operations on ref files.
 */

export { readRef, resolveRef } from './readRef.ts'
export { writeRef, writeSymbolicRef } from './writeRef.ts'
export { listRefs } from './listRefs.ts'
export { deleteRef, deleteRefs } from './deleteRef.ts'
export {
  refStash,
  refLogsStash,
  getStashRefPath,
  getStashReflogsPath,
  getStashAuthor,
  getStashSHA,
  writeStashCommit,
  readStashCommit,
  writeStashRef,
  writeStashReflogEntry,
  readStashReflogs,
} from './stash.ts'

