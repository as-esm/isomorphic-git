import { BaseError } from './BaseError.js'

export class UserCanceledError extends BaseError {
  static readonly code = 'UserCanceledError' as const

  constructor(cause?: Error) {
    super(`The operation was canceled.`, cause)
    this.code = this.name = UserCanceledError.code
    this.data = {}
  }
}

