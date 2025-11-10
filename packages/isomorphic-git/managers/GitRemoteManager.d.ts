/**
 * A class for managing Git remotes and determining the appropriate remote helper for a given URL.
 */
export class GitRemoteManager {
    /**
     * Determines the appropriate remote helper for the given URL.
     *
     * @param {Object} args
     * @param {string} args.url - The URL of the remote repository.
     * @returns {Object} - The remote helper class for the specified transport.
     * @throws {UrlParseError} - If the URL cannot be parsed.
     * @throws {UnknownTransportError} - If the transport is not supported.
     */
    static getRemoteHelperFor({ url }: {
        url: string;
    }): any;
}
