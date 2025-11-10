/**
 * Write a ref which refers to the specified SHA-1 object id, or a symbolic ref which refers to the specified ref.
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - The name of the ref to write
 * @param {string} args.value - When `symbolic` is false, a ref or an SHA-1 object id. When true, a ref starting with `refs/`.
 * @param {boolean} [args.force = false] - Instead of throwing an error if a ref named `ref` already exists, overwrite the existing ref.
 * @param {boolean} [args.symbolic = false] - Whether the ref is symbolic or not.
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.writeRef({
 *   fs,
 *   dir: '/tutorial',
 *   ref: 'refs/heads/another-branch',
 *   value: 'HEAD'
 * })
 * await git.writeRef({
 *   fs,
 *   dir: '/tutorial',
 *   ref: 'HEAD',
 *   value: 'refs/heads/another-branch',
 *   force: true,
 *   symbolic: true
 * })
 * console.log('done')
 *
 */
export function writeRef({ fs: _fs, dir, gitdir, ref, value, force, symbolic, }: {
    fs: FileSystem;
    dir?: string | undefined;
    gitdir?: string | undefined;
    ref: string;
    value: string;
    force?: boolean | undefined;
    symbolic?: boolean | undefined;
}): Promise<void>;
import { FileSystem } from '../models/FileSystem.js';
