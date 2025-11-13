import { MissingParameterError } from '../errors/MissingParameterError.js'

export const assertParameter = (name: string, value: unknown): void => {
  if (value === undefined) {
    throw new MissingParameterError(name)
  }
}

