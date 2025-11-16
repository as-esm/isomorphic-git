import ignore from 'ignore'
import { join } from '../GitPath.ts'
import { ConfigAccess } from "../../utils/configAccess.ts"
import { normalizeFs } from "../../utils/normalizeFs.ts"
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
    const patterns = (content as string)
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
    return patterns
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
    // Special case: `/*` or `*` pattern means everything is included at the root.
    // In cone mode, `/*` is not a glob, it's a directive to include all root-level entries.
    // Since our walk is recursive, simply returning true here effectively includes everything.
    // Note: The pattern may be stored as `*` in the file (without leading slash), so check both.
    // Also check normalized versions (with leading slash removed) to handle any normalization.
    for (const pattern of patterns) {
      const normalized = pattern.replace(/^\/+/, '')
      if (pattern === '/*' || pattern === '*' || normalized === '*') {
        return true
      }
    }
    
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
    
    // FIX: Implement precise cone mode matching logic.
    // A file matches a cone mode pattern if:
    // 1. It is the directory itself (e.g., filepath 'src', pattern 'src/')
    // 2. It is a descendant of the directory (e.g., filepath 'src/file.js', pattern 'src/')
    // This requires the path to start with the pattern, ensuring a directory boundary.
    
    let isIncluded = false
    if (inclusionPatterns.length === 0) {
      // If only negative patterns, nothing is included by default
      isIncluded = false
    } else {
      for (const pattern of inclusionPatterns) {
        // Normalize pattern: remove leading slashes
        let normalizedPattern = pattern.replace(/^\/+/, '')
        
        // Special case: /* matches everything
        if (normalizedPattern === '*' || normalizedPattern === '/*') {
          isIncluded = true
          break
        }
        
        // Case 1: The path is the directory itself (e.g., filepath 'src', pattern 'src/')
        // Remove trailing slash from pattern for exact match
        if (normalizedPath === normalizedPattern.replace(/\/$/, '')) {
          isIncluded = true
          break
        }
        
        // Case 2: The path is a descendant (e.g., filepath 'src/file.js', pattern 'src/')
        // This requires the path to start with the pattern, ensuring a directory boundary.
        // The pattern must end with / to create a proper boundary check.
        // This correctly excludes 'src-backup/file.js' from matching 'src/'
        // because 'src-backup/file.js' does NOT start with 'src/'
        const normalizedPatternWithSlash = normalizedPattern.endsWith('/') ? normalizedPattern : normalizedPattern + '/'
        if (normalizedPath.startsWith(normalizedPatternWithSlash)) {
          isIncluded = true
          break
        }
        
        // Case 3: The path is an ancestor directory (e.g., filepath 'src', pattern 'src/components/')
        // This allows the walker to enter directories leading to sparse directories.
        // We check if pattern starts with filepath, ensuring a proper directory boundary.
        // Normalize filepath with trailing slash for comparison
        const normalizedFilepathWithSlash = normalizedPath.endsWith('/') ? normalizedPath : normalizedPath + '/'
        if (normalizedPatternWithSlash.startsWith(normalizedFilepathWithSlash) && normalizedPatternWithSlash !== normalizedFilepathWithSlash) {
          // Pattern continues after the filepath, so filepath is an ancestor
          // The remaining part should start with a directory name (not a /)
          const remaining = normalizedPatternWithSlash.slice(normalizedFilepathWithSlash.length)
          if (remaining.length > 0 && remaining[0] !== '/') {
            isIncluded = true
            break
          }
        }
      }
    }
    
    // If it doesn't match any inclusion, exclude it
    if (!isIncluded) {
      return false
    }
    
    // Check if file matches any exclusion pattern (exclusions override inclusions)
    for (const pattern of exclusionPatterns) {
      // Normalize pattern: remove leading slashes
      let normalizedPattern = pattern.replace(/^\/+/, '')
      
      // Case 1: The path is the excluded directory itself
      if (normalizedPath === normalizedPattern.replace(/\/$/, '')) {
        return false
      }
      
      // Case 2: The path is a descendant of the excluded directory
      const normalizedPatternWithSlash = normalizedPattern.endsWith('/') ? normalizedPattern : normalizedPattern + '/'
      if (normalizedPath.startsWith(normalizedPatternWithSlash)) {
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
  
  // CRITICAL: Ensure the info directory exists before writing the file
  const infoDir = join(gitdir, 'info')
  const normalizedFs = normalizeFs(fs) // Normalize to ensure mkdir/write methods are available
  try {
    await normalizedFs.mkdir(infoDir, { recursive: true })
  } catch {
    // Directory might already exist, that's okay
  }

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

  await normalizedFs.write(sparseCheckoutFile, content, 'utf8')
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

