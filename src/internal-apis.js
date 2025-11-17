import * as Errors from './errors/index.ts'
export { Errors }

export * from './commands/listCommitsAndTags.ts'
export * from './commands/listObjects.ts'
export * from './commands/pack.ts'
export * from './commands/uploadPack.ts'

// @deprecated Manager classes - REMOVED in Phase 9.3
// All manager classes have been removed. Use src/git/ functions instead:
// - GitConfigManager → use src/git/config.ts functions (getConfig, setConfig, etc.)
// - GitIgnoreManager → use src/git/info/isIgnored.ts function
// - GitRemoteManager → use src/git/remote/getRemoteHelper.ts function
// - GitShallowManager → use src/git/shallow.ts functions
// - GitStashManager → use src/git/refs/stash.ts functions
// - GitRemoteHTTP → moved to src/git/remote/GitRemoteHTTP.ts
export * from './git/remote/GitRemoteHTTP.ts'

export * from './models/FileSystem.ts'
export * from './models/GitAnnotatedTag.ts'
export * from './models/GitCommit.ts'
export * from './models/GitConfig.ts'
export * from './git/index/GitIndex.ts'
export * from './models/GitObject.ts'
export * from './models/GitPackIndex.ts'
export * from './models/GitPktLine.ts'
export * from './models/GitRefSpec.ts'
export * from './models/GitRefSpecSet.ts'
export * from './models/GitSideBand.ts'
export * from './models/GitTree.ts'

// @deprecated Legacy storage exports - REMOVED in Phase 9.4
// All storage functions have been migrated to src/git/objects/:
// - readObject → use src/git/objects/readObject.ts
// - writeObject → use src/git/objects/writeObject.ts
// - readObjectPacked → use src/git/objects/pack.ts (read function)
// These exports are maintained for backward compatibility via re-exports from src/git/objects/
export { readObject } from './git/objects/readObject.ts'
export { writeObject } from './git/objects/writeObject.ts'
// Note: readObjectPacked functionality is available via pack.ts read function
// Legacy readObjectPacked export removed - use src/git/objects/pack.ts read function instead

export * from './utils/calculateBasicAuthHeader.ts'
export * from './utils/collect.ts'
export * from './utils/comparePath.ts'
export * from './utils/flatFileListToDirectoryStructure.ts'
export * from './utils/isBinary.ts'
export * from './utils/join.ts'
export * from './utils/mergeFile.ts'
export * from './utils/mergeTree.ts'
export * from './utils/modified.ts'
export * from './utils/normalizeAuthorObject.ts'
export * from './utils/normalizeCommitterObject.ts'
export * from './utils/padHex.ts'
export * from './utils/pkg.ts'
export * from './utils/resolveTree.ts'
export * from './utils/shasum.ts'
export * from './utils/sleep.ts'
export * from './utils/symbols.ts'

export * from './wire/parseReceivePackResponse.ts'
export * from './wire/parseRefsAdResponse.ts'
export * from './wire/parseUploadPackResponse.ts'
export * from './wire/parseUploadPackRequest.ts'
export * from './wire/writeReceivePackRequest.ts'
export * from './wire/writeRefsAdResponse.ts'
export * from './wire/writeUploadPackRequest.ts'
