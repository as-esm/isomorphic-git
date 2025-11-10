/**
 * Represents a Git object and provides methods to wrap and unwrap Git objects
 * according to the Git object format.
 */
export class GitObject {
    /**
     * Wraps a raw object with a Git header.
     *
     * @param {Object} params - The parameters for wrapping.
     * @param {string} params.type - The type of the Git object (e.g., 'blob', 'tree', 'commit').
     * @param {Uint8Array} params.object - The raw object data to wrap.
     * @returns {Uint8Array} The wrapped Git object as a single buffer.
     */
    static wrap({ type, object }: {
        type: string;
        object: Uint8Array;
    }): Uint8Array;
    /**
     * Unwraps a Git object buffer into its type and raw object data.
     *
     * @param {Buffer|Uint8Array} buffer - The buffer containing the wrapped Git object.
     * @returns {{ type: string, object: Buffer }} An object containing the type and the raw object data.
     * @throws {InternalError} If the length specified in the header does not match the actual object length.
     */
    static unwrap(buffer: Buffer | Uint8Array): {
        type: string;
        object: Buffer;
    };
}
