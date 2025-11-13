import { BaseError } from './BaseError.js'

export class FastForwardError extends BaseError {
  static readonly code = 'FastForwardError' as const

  constructor(cause?: Error) {
    super(`A simple fast-forward merge was not possible.`, cause)
    this.code = this.name = FastForwardError.code
    this.data = {}
  }
}

