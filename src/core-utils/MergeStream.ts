/**
 * Merge Stream - Encapsulates the merge process using Web Streams API
 * Provides proper flow control and event emission for merge operations
 * 
 * This stream wraps the mergeTree function and emits events for each stage
 * of the merge process, providing a clean audit trail and better encapsulation
 */

import { MergeConflictError } from '../errors/MergeConflictError.ts'
import { UnmergedPathsError } from '../errors/UnmergedPathsError.ts'
import { getStateMutationStream } from './StateMutationStream.ts'
import type { Repository } from './Repository.ts'
import type { GitIndex } from '../git/index/GitIndex.ts'

export type MergeStreamEvent =
  | { type: 'start'; data: { ourOid: string; baseOid: string; theirOid: string } }
  | { type: 'check-unmerged'; data: { hasUnmerged: boolean; unmergedPaths: string[] } }
  | { type: 'merge-start'; data: {} }
  | { type: 'merge-complete'; data: { treeOid: string } }
  | { type: 'merge-conflict'; data: { error: MergeConflictError } }
  | { type: 'error'; data: { error: Error } }

export interface MergeStreamOptions {
  repo: Repository
  index: GitIndex
  ourOid: string
  baseOid: string
  theirOid: string
  ourName?: string
  baseName?: string
  theirName?: string
  abortOnConflict?: boolean
  dryRun?: boolean
  mergeDriver?: (params: {
    branches: [string, string, string]
    contents: [string, string, string]
    path: string
  }) => { cleanMerge: boolean; mergedText: string }
}

/**
 * Merge Stream - Encapsulates the merge process with proper flow control
 * Uses Web Streams API to provide event-driven merge processing
 */
export class MergeStream extends ReadableStream<MergeStreamEvent> {
  private controller!: ReadableStreamDefaultController<MergeStreamEvent>
  private options!: MergeStreamOptions

  constructor(options: MergeStreamOptions) {
    let controller: ReadableStreamDefaultController<MergeStreamEvent>
    let mergePromise: Promise<void> | null = null
    
    super({
      start: (ctrl) => {
        controller = ctrl
      },
    })
    
    // Now we can safely set the properties and start
    this.controller = controller!
    this.options = options
    
    // Start the merge process asynchronously
    // Store the promise so we can wait for it if needed
    mergePromise = this.startMerge().catch((err: Error) => {
      this.emit({ type: 'error', data: { error: err } }).catch(() => {})
      try {
        controller.close()
      } catch {
        // Controller might already be closed
      }
    })
    
    // Store promise for potential external waiting
    ;(this as any)._mergePromise = mergePromise
  }

  private async emit(event: MergeStreamEvent): Promise<void> {
    try {
      this.controller.enqueue(event)
      // Also record in state mutation stream for audit trail
      const mutationStream = getStateMutationStream()
      const gitdir = await this.options.repo.getGitdir()
      const { normalize } = await import('./GitPath.ts')
      const normalizedGitdir = normalize(gitdir)
      
      if (event.type === 'merge-complete') {
        mutationStream.record({
          type: 'object-write',
          gitdir: normalizedGitdir,
          data: { treeOid: event.data.treeOid, operation: 'merge' },
        })
      } else if (event.type === 'merge-conflict') {
        mutationStream.record({
          type: 'index-write',
          gitdir: normalizedGitdir,
          data: { 
            operation: 'merge-conflict',
            conflictedFiles: event.data.error.data?.filepaths || [],
          },
        })
      }
    } catch (err) {
      // Stream might be closed, ignore
    }
  }

  private async startMerge(): Promise<void> {
    const { repo, index, ourOid, baseOid, theirOid } = this.options

    // Emit start event
    await this.emit({
      type: 'start',
      data: { ourOid, baseOid, theirOid },
    })

    // Check for unmerged paths
    const unmergedPaths = index.unmergedPaths
    await this.emit({
      type: 'check-unmerged',
      data: { hasUnmerged: unmergedPaths.length > 0, unmergedPaths },
    })

    // Always throw UnmergedPathsError if there are unmerged paths, regardless of abortOnConflict
    // This matches native git behavior - you cannot merge when there are unmerged paths
    if (unmergedPaths.length > 0) {
      const error = new UnmergedPathsError(unmergedPaths)
      await this.emit({ type: 'error', data: { error } })
      try {
        this.controller.close()
      } catch {
        // Controller might already be closed
      }
      throw error
    }

    // Use the existing mergeTree function - it's already well-tested
    const { mergeTree } = await import('../utils/mergeTree.ts')
    
    await this.emit({ type: 'merge-start', data: {} })

    try {
      const result = await mergeTree({
        repo,
        index,
        ourOid,
        baseOid,
        theirOid,
        ourName: this.options.ourName,
        baseName: this.options.baseName,
        theirName: this.options.theirName,
        abortOnConflict: this.options.abortOnConflict,
        dryRun: this.options.dryRun,
        mergeDriver: this.options.mergeDriver,
      })

      if (typeof result === 'string') {
        // Success - merge completed with tree OID
        await this.emit({
          type: 'merge-complete',
          data: { treeOid: result },
        })
        try {
          this.controller.close()
        } catch {
          // Controller might already be closed
        }
      } else {
        // Conflict - result is MergeConflictError
        await this.emit({
          type: 'merge-conflict',
          data: { error: result },
        })
        try {
          this.controller.close()
        } catch {
          // Controller might already be closed
        }
        throw result
      }
    } catch (error) {
      // Handle any errors from mergeTree
      if (error instanceof MergeConflictError) {
        await this.emit({
          type: 'merge-conflict',
          data: { error },
        })
        try {
          this.controller.close()
        } catch {
          // Controller might already be closed
        }
        throw error
      } else {
        await this.emit({ type: 'error', data: { error: error as Error } })
        try {
          this.controller.close()
        } catch {
          // Controller might already be closed
        }
        throw error
      }
    }
  }

  /**
   * Helper method to consume the stream and return the result
   * This is a convenience method for simple use cases
   */
  static async consume(stream: MergeStream): Promise<string | MergeConflictError> {
    const events: MergeStreamEvent[] = []
    let result: string | MergeConflictError | null = null
    let error: Error | null = null

    const reader = stream.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        events.push(value)

        if (value.type === 'merge-complete') {
          result = value.data.treeOid
        } else if (value.type === 'merge-conflict') {
          result = value.data.error
        } else if (value.type === 'error') {
          error = value.data.error
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (error && !(error instanceof MergeConflictError)) {
      throw error
    }

    if (result === null) {
      throw new Error('Merge stream did not produce a result')
    }

    return result
  }

  /**
   * Create a merge stream and consume it, returning the result
   * This is the simplest way to use the merge stream
   */
  static async execute(options: MergeStreamOptions): Promise<string | MergeConflictError> {
    const stream = new MergeStream(options)
    // Wait for the internal merge process to complete before consuming
    // This ensures all events are emitted before we start reading
    await (stream as any)._mergePromise
    return MergeStream.consume(stream)
  }
}

