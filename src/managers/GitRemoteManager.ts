import { UnknownTransportError } from '../errors/UnknownTransportError.js'
import { UrlParseError } from '../errors/UrlParseError.js'
import { translateSSHtoHTTP } from '../utils/translateSSHtoHTTP.js'

import { GitRemoteHTTP } from './GitRemoteHTTP.js'

type ParsedRemoteUrl = {
  transport: string
  address: string
}

/**
 * A class for managing Git remotes and determining the appropriate remote helper for a given URL.
 */
export class GitRemoteManager {
  /**
   * Determines the appropriate remote helper for the given URL.
   */
  static getRemoteHelperFor({
    url,
  }: {
    url: string
  }): typeof GitRemoteHTTP {
    // TODO: clean up the remoteHelper API and move into PluginCore
    const remoteHelpers = new Map<string, typeof GitRemoteHTTP>()
    remoteHelpers.set('http', GitRemoteHTTP)
    remoteHelpers.set('https', GitRemoteHTTP)

    const parts = parseRemoteUrl({ url })
    if (!parts) {
      throw new UrlParseError(url)
    }
    if (remoteHelpers.has(parts.transport)) {
      return remoteHelpers.get(parts.transport)!
    }
    throw new UnknownTransportError(
      url,
      parts.transport,
      parts.transport === 'ssh' ? translateSSHtoHTTP(url) : undefined
    )
  }
}

/**
 * Parses a remote URL and extracts its transport and address.
 */
function parseRemoteUrl({
  url,
}: {
  url: string
}): ParsedRemoteUrl | undefined {
  // the stupid "shorter scp-like syntax"
  if (url.startsWith('git@')) {
    return {
      transport: 'ssh',
      address: url,
    }
  }
  const matches = url.match(/(\w+)(:\/\/|::)(.*)/)
  if (matches === null) return undefined
  /*
   * When git encounters a URL of the form <transport>://<address>, where <transport> is
   * a protocol that it cannot handle natively, it automatically invokes git remote-<transport>
   * with the full URL as the second argument.
   *
   * @see https://git-scm.com/docs/git-remote-helpers
   */
  if (matches[2] === '://') {
    return {
      transport: matches[1],
      address: matches[0],
    }
  }
  /*
   * A URL of the form <transport>::<address> explicitly instructs git to invoke
   * git remote-<transport> with <address> as the second argument.
   *
   * @see https://git-scm.com/docs/git-remote-helpers
   */
  if (matches[2] === '::') {
    return {
      transport: matches[1],
      address: matches[3],
    }
  }
  return undefined
}

