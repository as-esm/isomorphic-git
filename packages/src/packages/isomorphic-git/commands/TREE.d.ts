/**
 * @param {object} args
 * @param {string} [args.ref='HEAD']
 * @returns {Walker}
 */
export function TREE({ ref }?: {
    ref?: string | undefined;
}): Walker;
