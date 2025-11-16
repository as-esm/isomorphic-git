import * as Errors from './errors/index.ts'
export { Errors }

export * from './commands/listCommitsAndTags.ts'
export * from './commands/listObjects.ts'
export * from './commands/pack.ts'
export * from './commands/uploadPack.ts'

// @deprecated Manager classes - use src/git/ functions instead
// GitConfigManager - use src/git/config.ts functions
export * from './managers/GitConfigManager.ts'
// GitIgnoreManager - use src/git/info/isIgnored.ts function
export * from './managers/GitIgnoreManager.ts'
export * from './managers/GitRemoteHTTP.ts'
// GitRemoteManager - use src/git/remote/getRemoteHelper.ts function
export * from './managers/GitRemoteManager.ts'
// GitShallowManager - use src/git/shallow.ts functions
export * from './managers/GitShallowManager.ts'
// GitStashManager - use src/git/refs/stash.ts functions
// Note: GitStashManager is exported via managers/index.ts, not here

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

// @deprecated Legacy storage exports - these now delegate to src/git/objects/
// Use src/git/objects/readObject.ts instead
export * from './storage/readObject.ts'
// Use src/git/objects/writeObject.ts instead
export * from './storage/writeObject.ts'
// @deprecated Use src/git/objects/pack.ts instead
export * from './storage/readObjectPacked.ts'

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
