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
    // In Git v2.4+, cone mode supports negative patterns with ! prefix
    // - Patterns without ! are inclusion patterns
    // - Patterns with ! are exclusion patterns
    // - A file is included if it matches an inclusion AND doesn't match any exclusion
    
    // Separate inclusion and exclusion patterns
    const inclusionPatterns: string[] = []
    const exclusionPatterns: string[] = []
    
    for (const pattern of patterns) {
      if (pattern.startsWith('!')) {
        // Exclusion pattern: remove the ! prefix
        exclusionPatterns.push(pattern.substring(1))
      } else {
        // Inclusion pattern
        inclusionPatterns.push(pattern)
      }
    }
    
    // If no inclusion patterns, nothing is included
    if (inclusionPatterns.length === 0) {
      return false
    }
    
    // Normalize filepath for comparison (remove leading slash if present)
    const normalizedPath = filepath.replace(/^\/+/, '')
    
    // Check if file matches any inclusion pattern
    let matchesInclusion = false
    for (const pattern of inclusionPatterns) {
      // Normalize pattern: remove leading slashes
      let normalizedPattern = pattern.replace(/^\/+/, '') // Remove leading slashes
      
      // Special case: /* matches everything
      if (normalizedPattern === '*' || normalizedPattern === '/*') {
        matchesInclusion = true
        break
      }
      
      // Ensure it ends with / for directory matching (unless it's a wildcard pattern)
      if (!normalizedPattern.endsWith('/') && !normalizedPattern.includes('*')) {
        normalizedPattern += '/'
      }
      
      // Match if filepath is exactly the directory or is within it
      // In cone mode, we need exact prefix matching (e.g., "src/" matches "src/file.txt" but not "src-backup/file.txt")
      const patternWithoutSlash = normalizedPattern.replace(/\/$/, '')
      if (normalizedPath === patternWithoutSlash) {
        // Exact match
        matchesInclusion = true
        break
      } else if (normalizedPath.startsWith(normalizedPattern)) {
        // Path starts with pattern (which ends with /), so it's within the directory
        matchesInclusion = true
        break
      } else if (normalizedPath.startsWith(patternWithoutSlash + '/')) {
        // Path starts with pattern + /, so it's within the directory
        // This handles the case where pattern doesn't have trailing slash but path does
        matchesInclusion = true
        break
      }
    }
    
    // If it doesn't match any inclusion, exclude it
    if (!matchesInclusion) {
      return false
    }
    
    // Check if file matches any exclusion pattern (exclusions override inclusions)
    for (const pattern of exclusionPatterns) {
      // Normalize pattern: remove leading slashes
      let normalizedPattern = pattern.replace(/^\/+/, '') // Remove leading slashes
      
      // Ensure it ends with / for directory matching (unless it's a wildcard pattern)
      if (!normalizedPattern.endsWith('/') && !normalizedPattern.includes('*')) {
        normalizedPattern += '/'
      }
      
      // Match if filepath is exactly the directory or is within it
      if (normalizedPath === normalizedPattern.replace(/\/$/, '') || 
          normalizedPath.startsWith(normalizedPattern)) {
        // Matches exclusion pattern, so exclude it
        return false
      }
    }
    
    // Matches inclusion and doesn't match any exclusion
    return true
  } else {
    // Non-cone mode: use gitignore-style pattern matching
    const ign = ignore().add(patterns.join('\n'))
    // In sparse checkout, patterns are inclusion patterns (opposite of gitignore)
    // So we check if the path is NOT ignored
    return !ign.ignores(filepath)
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

  // Format patterns according to Git v2.4+ format
  // In cone mode, patterns are written as-is (directory paths)
  // In non-cone mode, patterns use gitignore syntax
  // Negative patterns with ! prefix are preserved in both modes
  let content = '# This file is used by sparse checkout\n'
  if (coneMode) {
    content += '# Enable cone mode for better performance\n'
    // In cone mode, Git v2.4+ expects patterns without leading slashes for root-level dirs
    // and with leading slashes for nested dirs. We normalize them.
    // Negative patterns (starting with !) are preserved as-is
    const normalizedPatterns = patterns.map(p => {
      // Preserve negative patterns (starting with !)
      if (p.startsWith('!')) {
        const patternWithoutExcl = p.substring(1)
        // Normalize the pattern part (after !)
        let normalized = patternWithoutExcl.replace(/^\/+/, '')
        // Ensure trailing slash for directories in cone mode
        if (!normalized.endsWith('/') && !normalized.includes('*')) {
          normalized += '/'
        }
        return '!' + normalized
      } else {
        // Normal inclusion pattern
        let normalized = p.replace(/^\/+/, '')
        // Ensure trailing slash for directories in cone mode
        if (!normalized.endsWith('/') && !normalized.includes('*')) {
          normalized += '/'
        }
        return normalized
      }
    })
    content += normalizedPatterns.join('\n') + '\n'
  } else {
    // In non-cone mode, patterns (including !) are written as-is
    content += patterns.join('\n') + '\n'
  }

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
  // Note: UnifiedConfigService.set() already reloads, so config should be available

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
 * Checks if cone mode is enabled for sparse checkout
 */
export const isConeMode = async ({
  fs,
  gitdir,
}: {
  fs: FsClient
  gitdir: string
}): Promise<boolean> => {
  try {
    const configAccess = new ConfigAccess(fs, gitdir)
    const value = await configAccess.getConfigValue('core.sparseCheckoutCone')
    return value === 'true' || value === true
  } catch {
    return false
  }
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
  isConeMode,
}

