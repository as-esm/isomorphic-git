/**
 * @typedef {Object} ServerRef - This object has the following schema:
 * @property {string} ref - The name of the ref
 * @property {string} oid - The SHA-1 object id the ref points to
 * @property {string} [target] - The target ref pointed to by a symbolic ref
 * @property {string} [peeled] - If the oid is the SHA-1 object id of an annotated tag, this is the SHA-1 object id that the annotated tag points to
 */
export function parseListRefsResponse(stream: any): Promise<{
    ref: any;
    oid: any;
}[]>;
/**
 * - This object has the following schema:
 */
export type ServerRef = {
    /**
     * - The name of the ref
     */
    ref: string;
    /**
     * - The SHA-1 object id the ref points to
     */
    oid: string;
    /**
     * - The target ref pointed to by a symbolic ref
     */
    target?: string | undefined;
    /**
     * - If the oid is the SHA-1 object id of an annotated tag, this is the SHA-1 object id that the annotated tag points to
     */
    peeled?: string | undefined;
};
