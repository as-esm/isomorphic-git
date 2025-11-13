import { join } from '../GitPath.js'
import type { FsClient } from "../../models/FileSystem.ts"

type ReflogEntry = {
  oldOid: string
  newOid: string
  author: string
  timestamp: number
  timezoneOffset: string
  message: string
}

/**
 * Parses a reflog entry
 * Format: <old-oid> <new-oid> <author> <timestamp> <timezone-offset> <message>
 */
export const parseReflogEntry = (line: string): ReflogEntry | null => {
  if (!line || !line.trim()) return null

  // Reflog format: <old-oid> <new-oid> <author> <timestamp> <timezone-offset> <message>
  // Example: 0000000000000000000000000000000000000000 abc123... John Doe <john@example.com> 1234567890 -0500 message
  const parts = line.trim().split(/\s+/)
  if (parts.length < 5) return null

  const oldOid = parts[0]
  const newOid = parts[1]

  // Author name and email are in angle brackets
  let authorIndex = 2
  let author = parts[authorIndex]
  if (parts[authorIndex + 1] && parts[authorIndex + 1].startsWith('<')) {
    // Author has email
    while (authorIndex < parts.length && !parts[authorIndex].endsWith('>')) {
      authorIndex++
    }
    author = parts.slice(2, authorIndex + 1).join(' ')
    authorIndex++
  }

  const timestamp = parseInt(parts[authorIndex], 10)
  const timezoneOffset = parts[authorIndex + 1]
  const message = parts.slice(authorIndex + 2).join(' ') || ''

  return {
    oldOid,
    newOid,
    author,
    timestamp,
    timezoneOffset,
    message,
  }
}

/**
 * Formats a reflog entry
 */
export const formatReflogEntry = ({
  oldOid,
  newOid,
  author,
  timestamp,
  timezoneOffset,
  message = '',
}: ReflogEntry): string => {
  return `${oldOid} ${newOid} ${author} ${timestamp} ${timezoneOffset} ${message}`.trim()
}

/**
 * Gets the reflog file path for a ref
 */
export const getReflogPath = (gitdir: string, ref: string): string => {
  // Reflog files are in .git/logs/<ref>
  // For HEAD, it's .git/logs/HEAD
  // For refs/heads/main, it's .git/logs/refs/heads/main
  return join(gitdir, 'logs', ref)
}

/**
 * Reads reflog entries for a ref
 */
export const readReflog = async ({
  fs,
  gitdir,
  ref,
  parsed = false,
}: {
  fs: FsClient
  gitdir: string
  ref: string
  parsed?: boolean
}): Promise<Array<string | ReflogEntry>> => {
  const reflogPath = getReflogPath(gitdir, ref)

  try {
    const content = (await fs.read(reflogPath, 'utf8')) as string
    const lines = content.split('\n').filter(line => line.trim())

    if (parsed) {
      return lines.map(parseReflogEntry).filter((entry): entry is ReflogEntry => entry !== null)
    }
    return lines
  } catch (err) {
    if ((err as { code?: string }).code === 'NOENT') {
      return []
    }
    throw err
  }
}

/**
 * Appends a reflog entry
 */
export const appendReflog = async ({
  fs,
  gitdir,
  ref,
  entry,
}: {
  fs: FsClient
  gitdir: string
  ref: string
  entry: ReflogEntry
}): Promise<void> => {
  const reflogPath = getReflogPath(gitdir, ref)
  const line = formatReflogEntry(entry) + '\n'

  // Ensure the directory exists
  const dir = reflogPath.substring(0, reflogPath.lastIndexOf('/'))
  await fs.mkdir(dir, { recursive: true })

  // Append to file
  try {
    const existing = (await fs.read(reflogPath, 'utf8')) as string
    await fs.write(reflogPath, existing + line, 'utf8')
  } catch (err) {
    if ((err as { code?: string }).code === 'NOENT') {
      await fs.write(reflogPath, line, 'utf8')
    } else {
      throw err
    }
  }
}

/**
 * Writes a reflog entry (replaces the entire reflog)
 */
export const writeReflog = async ({
  fs,
  gitdir,
  ref,
  entries,
}: {
  fs: FsClient
  gitdir: string
  ref: string
  entries: ReflogEntry[]
}): Promise<void> => {
  const reflogPath = getReflogPath(gitdir, ref)
  const content = entries.map(formatReflogEntry).join('\n') + '\n'

  // Ensure the directory exists
  const dir = reflogPath.substring(0, reflogPath.lastIndexOf('/'))
  await fs.mkdir(dir, { recursive: true })

  await fs.write(reflogPath, content, 'utf8')
}

/**
 * Deletes a reflog file
 */
export const deleteReflog = async ({
  fs,
  gitdir,
  ref,
}: {
  fs: FsClient
  gitdir: string
  ref: string
}): Promise<void> => {
  const reflogPath = getReflogPath(gitdir, ref)
  try {
    await fs.rm(reflogPath)
  } catch (err) {
    if ((err as { code?: string }).code !== 'NOENT') {
      throw err
    }
  }
}
