import ignore from 'ignore'
import { join } from '../GitPath.ts'
import { ConfigAccess } from "../../utils/configAccess.ts"
import type { FsClient } from "../../models/FileSystem.ts"

/**
 * Loads sparse checkout patterns from .git/info/sparse-checkout
 */
export const loadPatterns = async ({
  fs,
  gitdir,
}: {
  fs: FsClient
  gitdir: string
}): Promise<string[]> => {
  const sparseCheckoutFile = join(gitdir, 'info', 'sparse-checkout')
  try {
    const content = await fs.read(sparseCheckoutFile, 'utf8')
    return (content as string)
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
  } catch (err) {
    if ((err as { code?: string }).code === 'NOENT') {
      return []
    }
    throw err
  }
}

/**
 * Determines if a filepath matches any of the sparse checkout patterns
 */
export const match = ({
  filepath,
  patterns,
  coneMode = false,
}: {
  filepath: string
  patterns: string[]
  coneMode?: boolean
}): boolean => {
  if (patterns.length === 0) {
    // No patterns means everything is included
    return true
  }

  if (coneMode) {
    // Cone mode: patterns are directory prefixes
    // A file matches if it's within any of the specified directories
    for (const pattern of patterns) {
      const normalizedPattern = pattern.replace(/\/$/, '') // Remove trailing slash
      if (filepath === normalizedPattern || filepath.startsWith(normalizedPattern + '/')) {
        return true
      }
    }
    return false
  } else {
    // Non-cone mode: use gitignore-style pattern matching
    const ign = ignore().add(patterns.join('\n'))
    // In sparse checkout, patterns are inclusion patterns (opposite of gitignore)
    // So we check if the path is NOT ignored
    return !ign.test(filepath).ignored
  }
}

/**
 * Sets sparse checkout patterns
 */
export const set = async ({
  fs,
  gitdir,
  patterns,
  coneMode = false,
}: {
  fs: FsClient
  gitdir: string
  patterns: string[]
  coneMode?: boolean
}): Promise<void> => {
  const sparseCheckoutFile = join(gitdir, 'info', 'sparse-checkout')

  // Format patterns with comments
  let content = '# This file is used by sparse checkout\n'
  if (coneMode) {
    content += '# Enable cone mode for better performance\n'
  }
  content += patterns.join('\n') + '\n'

  await fs.write(sparseCheckoutFile, content, 'utf8')
}

/**
 * Initializes sparse checkout
 */
export const init = async ({
  fs,
  gitdir,
  coneMode = false,
}: {
  fs: FsClient
  gitdir: string
  coneMode?: boolean
}): Promise<void> => {
  // Enable sparse checkout in config
  const configAccess = new ConfigAccess(fs, gitdir)
  await configAccess.setConfigValue('core.sparseCheckout', 'true', 'local')
  if (coneMode) {
    await configAccess.setConfigValue('core.sparseCheckoutCone', 'true', 'local')
  }

  // Create sparse-checkout file with default pattern (everything)
  await set({ fs, gitdir, patterns: ['/*'], coneMode })
}

/**
 * Lists current sparse checkout patterns
 */
export const list = async ({
  fs,
  gitdir,
}: {
  fs: FsClient
  gitdir: string
}): Promise<string[]> => {
  return loadPatterns({ fs, gitdir })
}

/**
 * Namespace export for SparseCheckoutManager
 */
export const SparseCheckoutManager = {
  loadPatterns,
  match,
  set,
  init,
  list,
}

