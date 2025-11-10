/**
 * @param {object} args
 * @param {string} [args.prefix] - Only list refs that start with this prefix
 * @param {boolean} [args.symrefs = false] - Include symbolic ref targets
 * @param {boolean} [args.peelTags = false] - Include peeled tags values
 * @returns {Uint8Array[]}
 */
export function writeListRefsRequest({ prefix, symrefs, peelTags }: {
    prefix?: string | undefined;
    symrefs?: boolean | undefined;
    peelTags?: boolean | undefined;
}): Uint8Array[];
