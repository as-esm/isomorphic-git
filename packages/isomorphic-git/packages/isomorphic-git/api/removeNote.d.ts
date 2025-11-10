/**
 * Remove an object note
 *
 * @param {object} args
 * @param {FileSystem} args.fs - a file system client
 * @param {SignCallback} [args.onSign] - a PGP signing implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,'.git')] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.ref] - The notes ref to look under
 * @param {string} args.oid - The SHA-1 object id of the object to remove the note from.
 * @param {Object} [args.author] - The details about the author.
 * @param {string} [args.author.name] - Default is `user.name` config.
 * @param {string} [args.author.email] - Default is `user.email` config.
 * @param {number} [args.author.timestamp=Math.floor(Date.now()/1000)] - Set the author timestamp field. This is the integer number of seconds since the Unix epoch (1970-01-01 00:00:00).
 * @param {number} [args.author.timezoneOffset] - Set the author timezone offset field. This is the difference, in minutes, from the current timezone to UTC. Default is `(new Date()).getTimezoneOffset()`.
 * @param {Object} [args.committer = author] - The details about the note committer, in the same format as the author parameter. If not specified, the author details are used.
 * @param {string} [args.committer.name] - Default is `user.name` config.
 * @param {string} [args.committer.email] - Default is `user.email` config.
 * @param {number} [args.committer.timestamp=Math.floor(Date.now()/1000)] - Set the committer timestamp field. This is the integer number of seconds since the Unix epoch (1970-01-01 00:00:00).
 * @param {number} [args.committer.timezoneOffset] - Set the committer timezone offset field. This is the difference, in minutes, from the current timezone to UTC. Default is `(new Date()).getTimezoneOffset()`.
 * @param {string} [args.signingKey] - Sign the tag object using this private PGP key.
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<string>} Resolves successfully with the SHA-1 object id of the commit object for the note removal.
 */
export function removeNote({ fs: _fs, onSign, dir, gitdir, ref, oid, author: _author, committer: _committer, signingKey, cache, }: {
    fs: FileSystem;
    onSign?: any;
    dir?: string | undefined;
    gitdir?: string | undefined;
    ref?: string | undefined;
    oid: string;
    author?: {
        name?: string | undefined;
        email?: string | undefined;
        timestamp?: number | undefined;
        timezoneOffset?: number | undefined;
    } | undefined;
    committer?: {
        name?: string | undefined;
        email?: string | undefined;
        timestamp?: number | undefined;
        timezoneOffset?: number | undefined;
    } | undefined;
    signingKey?: string | undefined;
    cache?: object;
}): Promise<string>;
import { FileSystem } from '../models/FileSystem.js';
