import { BaseError } from './BaseError.js'
import type { PushResult } from '../api/push.js'

export class GitPushError extends BaseError {
  static readonly code = 'GitPushError' as const

  constructor(prettyDetails: string, result: PushResult, cause?: Error) {
    super(`One or more branches were not updated: ${prettyDetails}`, cause)
    this.code = this.name = GitPushError.code
    this.data = { prettyDetails, result }
  }
}

