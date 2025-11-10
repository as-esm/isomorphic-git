/**
 *
 * @typedef {object} HashBlobResult - The object returned has the following schema:
 * @property {string} oid - The SHA-1 object id
 * @property {'blob'} type - The type of the object
 * @property {Uint8Array} object - The wrapped git object (the thing that is hashed)
 * @property {'wrapped'} format - The format of the object
 *
 */
/**
 * Compute what the SHA-1 object id of a file would be
 *
 * @param {object} args
 * @param {Uint8Array|string} args.object - The object to write. If `object` is a String then it will be converted to a Uint8Array using UTF-8 encoding.
 *
 * @returns {Promise<HashBlobResult>} Resolves successfully with the SHA-1 object id and the wrapped object Uint8Array.
 * @see HashBlobResult
 *
 * @example
 * let { oid, type, object, format } = await git.hashBlob({
 *   object: 'Hello world!',
 * })
 *
 * console.log('oid', oid)
 * console.log('type', type)
 * console.log('object', object)
 * console.log('format', format)
 *
 */
export function hashBlob({ object }: {
    object: Uint8Array | string;
}): Promise<HashBlobResult>;
/**
 * - The object returned has the following schema:
 */
export type HashBlobResult = {
    /**
     * - The SHA-1 object id
     */
    oid: string;
    /**
     * - The type of the object
     */
    type: "blob";
    /**
     * - The wrapped git object (the thing that is hashed)
     */
    object: Uint8Array;
    /**
     * - The format of the object
     */
    format: "wrapped";
};
