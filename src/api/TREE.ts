import type { Walker } from "../models/Walker.ts"

/**
 * @deprecated Use `TREE` from 'isomorphic-git/commands' instead
 * 
 * Get a git commit `Walker`
 *
 * See [walk](./walk.md)
 *
 * @param {object} args
 * @param {string} [args.ref='HEAD'] - The commit to walk
 *
 * @returns {Walker} Returns a git commit Walker
 *
 */
export { TREE } from '../commands/TREE.ts'
