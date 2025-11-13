import { BaseError } from './BaseError.js'

export class NotFoundError extends BaseError {
  static readonly code = 'NotFoundError' as const

  constructor(what: string) {
    super(`Could not find ${what}.`)
    this.code = this.name = NotFoundError.code
    this.data = { what }
  }
}

