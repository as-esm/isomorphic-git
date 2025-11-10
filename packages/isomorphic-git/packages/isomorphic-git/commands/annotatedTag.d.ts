/**
 * Create an annotated tag.
 *
 * @param {object} args
 * @param {import('../models/FileSystem.js').FileSystem} args.fs
 * @param {any} args.cache
 * @param {SignCallback} [args.onSign]
 * @param {string} args.gitdir
 * @param {string} args.ref
 * @param {string} [args.message = ref]
 * @param {string} [args.object = 'HEAD']
 * @param {object} [args.tagger]
 * @param {string} args.tagger.name
 * @param {string} args.tagger.email
 * @param {number} args.tagger.timestamp
 * @param {number} args.tagger.timezoneOffset
 * @param {string} [args.gpgsig]
 * @param {string} [args.signingKey]
 * @param {boolean} [args.force = false]
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.annotatedTag({
 *   dir: '$input((/))',
 *   ref: '$input((test-tag))',
 *   message: '$input((This commit is awesome))',
 *   tagger: {
 *     name: '$input((Mr. Test))',
 *     email: '$input((mrtest@example.com))'
 *   }
 * })
 * console.log('done')
 *
 */
export function _annotatedTag({ fs, cache, onSign, gitdir, ref, tagger, message, gpgsig, object, signingKey, force, }: {
    fs: import("../models/FileSystem.js").FileSystem;
    cache: any;
    onSign?: any;
    gitdir: string;
    ref: string;
    message?: string | undefined;
    object?: string | undefined;
    tagger?: {
        name: string;
        email: string;
        timestamp: number;
        timezoneOffset: number;
    } | undefined;
    gpgsig?: string | undefined;
    signingKey?: string | undefined;
    force?: boolean | undefined;
}): Promise<void>;
