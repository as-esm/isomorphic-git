import '../typedefs.ts';
import type { FileSystem } from '../internal-apis.ts';
export declare class GitStashManager {
    fs: FileSystem;
    gitdir: string;
    private _author;
    /**
     * Creates an instance of GitStashManager.
     *
     * @param {Object} args
     * @param {FileSystem} args.fs - A file system implementation.
     * @param {string} args.dir - The working directory.
     * @param {string}[args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
     */
    constructor({ fs, dir, gitdir }: {
        fs: any;
        dir: any;
        gitdir?: any;
    });
    /**
     * Gets the reference name for the stash.
     *
     * @returns {string} - The stash reference name.
     */
    static get refStash(): string;
    /**
     * Gets the reference name for the stash reflogs.
     *
     * @returns {string} - The stash reflogs reference name.
     */
    static get refLogsStash(): string;
    /**
     * Gets the file path for the stash reference.
     *
     * @returns {string} - The file path for the stash reference.
     */
    get refStashPath(): any;
    /**
     * Gets the file path for the stash reflogs.
     *
     * @returns {string} - The file path for the stash reflogs.
     */
    get refLogsStashPath(): any;
    /**
     * Retrieves the author information for the stash.
     *
     * @returns {Promise<Object>} - The author object.
     * @throws {MissingNameError} - If the author name is missing.
     */
    getAuthor(): Promise<string>;
    /**
     * Gets the SHA of a stash entry by its index.
     *
     * @param {number} refIdx - The index of the stash entry.
     * @param {string[]} [stashEntries] - Optional preloaded stash entries.
     * @returns {Promise<string|null>} - The SHA of the stash entry or `null` if not found.
     */
    getStashSHA(refIdx: any, stashEntries: any): Promise<any>;
    /**
     * Writes a stash commit to the repository.
     *
     * @param {Object} args
     * @param {string} args.message - The commit message.
     * @param {string} args.tree - The tree object ID.
     * @param {string[]} args.parent - The parent commit object IDs.
     * @returns {Promise<string>} - The object ID of the written commit.
     */
    writeStashCommit({ message, tree, parent }: {
        message: any;
        tree: any;
        parent: any;
    }): Promise<string>;
    /**
     * Reads a stash commit by its index.
     *
     * @param {number} refIdx - The index of the stash entry.
     * @returns {Promise<Object>} - The stash commit object.
     * @throws {InvalidRefNameError} - If the index is invalid.
     */
    readStashCommit(refIdx: any): Promise<any>;
    /**
     * Writes a stash reference to the repository.
     *
     * @param {string} stashCommit - The object ID of the stash commit.
     * @returns {Promise<void>}
     */
    writeStashRef(stashCommit: any): Promise<void>;
    /**
     * Writes a reflog entry for a stash commit.
     *
     * @param {Object} args
     * @param {string} args.stashCommit - The object ID of the stash commit.
     * @param {string} args.message - The reflog message.
     * @returns {Promise<void>}
     */
    writeStashReflogEntry({ stashCommit, message }: {
        stashCommit: any;
        message: any;
    }): Promise<void>;
    /**
     * Reads the stash reflogs.
     *
     * @param {Object} args
     * @param {boolean} [args.parsed=false] - Whether to parse the reflog entries.
     * @returns {Promise<string[]|Object[]>} - The reflog entries as strings or parsed objects.
     */
    readStashReflogs({ parsed }: {
        parsed?: boolean | undefined;
    }): Promise<any>;
}
