import { BaseError } from './BaseError.js'

export class InvalidOidError extends BaseError {
  static readonly code = 'InvalidOidError' as const

  constructor(value: string) {
    super(`Expected a 40-char hex object id but saw "${value}".`)
    this.code = this.name = InvalidOidError.code
    this.data = { value }
  }
}

