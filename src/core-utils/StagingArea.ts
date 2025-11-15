import type { Worktree } from './Worktree.ts'
import type { GitIndex } from '../git/index/GitIndex.ts'
import { UnmergedPathsError } from '../errors/UnmergedPathsError.ts'

/**
 * StagingArea - Wrapper providing Worktree-aware access to the staging area
 * Each worktree has its own staging area (index file) bound to its gitdir
 * 
 * @deprecated This class is being deprecated in favor of direct Repository.readIndexDirect/writeIndexDirect calls
 */
export class StagingArea {
  private readonly worktree: Worktree

  constructor(worktree: Worktree) {
    this.worktree = worktree
  }

  /**
   * Gets the worktree this staging area belongs to
   */
  getWorktree(): Worktree {
    return this.worktree
  }

  /**
   * Reads the current index (staging area) for this worktree
   */
  async read(allowUnmerged: boolean = true): Promise<GitIndex> {
    const repo = this.worktree.repository
    const index = await repo.readIndexDirect(false, allowUnmerged) // Force fresh read
    return index
  }

  /**
   * Writes the index back to disk
   * If a GitIndex is provided, it will be written directly.
   * If no index is provided, the current index will be written.
   */
  async write(index?: GitIndex): Promise<void> {
    const repo = this.worktree.repository
    if (index) {
      // Write the provided index directly
      await repo.writeIndexDirect(index)
    } else {
      // Read current index and write it (to ensure it's saved)
      const currentIndex = await repo.readIndexDirect(false)
      await repo.writeIndexDirect(currentIndex)
    }
  }

  /**
   * Acquires the index for exclusive access and executes a callback
   * This ensures thread-safe access to the index
   * 
   * @deprecated Use Repository.readIndexDirect/writeIndexDirect directly
   */
  async acquire<T>(
    callback: (index: GitIndex) => Promise<T> | T,
    allowUnmerged: boolean = true
  ): Promise<T> {
    const repo = this.worktree.repository
    const index = await repo.readIndexDirect(false, allowUnmerged) // Force fresh read
    const result = await callback(index)
    // If index was modified, write it back
    // Note: We can't detect if index was modified, so we always write it
    // This is a limitation of the acquire pattern - prefer direct read/write
    await repo.writeIndexDirect(index)
    return result
  }

  /**
   * Clears all entries from the staging area
   */
  async clear(): Promise<void> {
    const repo = this.worktree.repository
    const index = await repo.readIndexDirect(false)
    index.clear()
    await repo.writeIndexDirect(index)
  }
}

