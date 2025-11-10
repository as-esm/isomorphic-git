/**
 * A class for managing Git references, including reading, writing, deleting, and resolving refs.
 */
export class GitRefManager {
    /**
     * Updates remote refs based on the provided refspecs and options.
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
     * @param {string} args.remote - The name of the remote.
     * @param {Map<string, string>} args.refs - A map of refs to their object IDs.
     * @param {Map<string, string>} args.symrefs - A map of symbolic refs.
     * @param {boolean} args.tags - Whether to fetch tags.
     * @param {string[]} [args.refspecs = undefined] - The refspecs to use.
     * @param {boolean} [args.prune = false] - Whether to prune stale refs.
     * @param {boolean} [args.pruneTags = false] - Whether to prune tags.
     * @returns {Promise<Object>} - An object containing pruned refs.
     */
    static updateRemoteRefs({ fs, gitdir, remote, refs, symrefs, tags, refspecs, prune, pruneTags, }: {
        fs: FSClient;
        gitdir?: string | undefined;
        remote: string;
        refs: Map<string, string>;
        symrefs: Map<string, string>;
        tags: boolean;
        refspecs?: string[] | undefined;
        prune?: boolean | undefined;
        pruneTags?: boolean | undefined;
    }): Promise<any>;
    /**
     * Writes a ref to the file system.
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
     * @param {string} args.ref - The ref to write.
     * @param {string} args.value - The object ID to write.
     * @returns {Promise<void>}
     */
    static writeRef({ fs, gitdir, ref, value }: {
        fs: FSClient;
        gitdir?: string | undefined;
        ref: string;
        value: string;
    }): Promise<void>;
    /**
     * Writes a symbolic ref to the file system.
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
     * @param {string} args.ref - The ref to write.
     * @param {string} args.value - The target ref.
     * @returns {Promise<void>}
     */
    static writeSymbolicRef({ fs, gitdir, ref, value }: {
        fs: FSClient;
        gitdir?: string | undefined;
        ref: string;
        value: string;
    }): Promise<void>;
    /**
     * Deletes a single ref.
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
     * @param {string} args.ref - The ref to delete.
     * @returns {Promise<void>}
     */
    static deleteRef({ fs, gitdir, ref }: {
        fs: FSClient;
        gitdir?: string | undefined;
        ref: string;
    }): Promise<void>;
    /**
     * Deletes multiple refs.
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
     * @param {string[]} args.refs - The refs to delete.
     * @returns {Promise<void>}
     */
    static deleteRefs({ fs, gitdir, refs }: {
        fs: FSClient;
        gitdir?: string | undefined;
        refs: string[];
    }): Promise<void>;
    /**
     * Resolves a ref to its object ID.
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
     * @param {string} args.ref - The ref to resolve.
     * @param {number} [args.depth = undefined] - The maximum depth to resolve symbolic refs.
     * @returns {Promise<string>} - The resolved object ID.
     */
    static resolve({ fs, gitdir, ref, depth }: {
        fs: FSClient;
        gitdir?: string | undefined;
        ref: string;
        depth?: number | undefined;
    }): Promise<string>;
    /**
     * Checks if a ref exists.
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
     * @param {string} args.ref - The ref to check.
     * @returns {Promise<boolean>} - True if the ref exists, false otherwise.
     */
    static exists({ fs, gitdir, ref }: {
        fs: FSClient;
        gitdir?: string | undefined;
        ref: string;
    }): Promise<boolean>;
    /**
     * Expands a ref to its full name.
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
     * @param {string} args.ref - The ref to expand.
     * @returns {Promise<string>} - The full ref name.
     */
    static expand({ fs, gitdir, ref }: {
        fs: FSClient;
        gitdir?: string | undefined;
        ref: string;
    }): Promise<string>;
    /**
     * Expands a ref against a provided map.
     *
     * @param {Object} args
     * @param {string} args.ref - The ref to expand.
     * @param {Map<string, string>} args.map - The map of refs.
     * @returns {Promise<string>} - The expanded ref.
     */
    static expandAgainstMap({ ref, map }: {
        ref: string;
        map: Map<string, string>;
    }): Promise<string>;
    /**
     * Resolves a ref against a provided map.
     *
     * @param {Object} args
     * @param {string} args.ref - The ref to resolve.
     * @param {string} [args.fullref = args.ref] - The full ref name.
     * @param {number} [args.depth = undefined] - The maximum depth to resolve symbolic refs.
     * @param {Map<string, string>} args.map - The map of refs.
     * @returns {Object} - An object containing the full ref and its object ID.
     */
    static resolveAgainstMap({ ref, fullref, depth, map }: {
        ref: string;
        fullref?: string | undefined;
        depth?: number | undefined;
        map: Map<string, string>;
    }): any;
    /**
     * Reads the packed refs file and returns a map of refs.
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
     * @returns {Promise<Map<string, string>>} - A map of packed refs.
     */
    static packedRefs({ fs, gitdir }: {
        fs: FSClient;
        gitdir?: string | undefined;
    }): Promise<Map<string, string>>;
    /**
     * Lists all refs matching a given filepath prefix.
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
     * @param {string} args.filepath - The filepath prefix to match.
     * @returns {Promise<string[]>} - A sorted list of refs.
     */
    static listRefs({ fs, gitdir, filepath }: {
        fs: FSClient;
        gitdir?: string | undefined;
        filepath: string;
    }): Promise<string[]>;
    /**
     * Lists all branches, optionally filtered by remote.
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
     * @param {string} [args.remote] - The remote to filter branches by.
     * @returns {Promise<string[]>} - A list of branch names.
     */
    static listBranches({ fs, gitdir, remote }: {
        fs: FSClient;
        gitdir?: string | undefined;
        remote?: string | undefined;
    }): Promise<string[]>;
    /**
     * Lists all tags.
     *
     * @param {Object} args
     * @param {FSClient} args.fs - A file system implementation.
     * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
     * @returns {Promise<string[]>} - A list of tag names.
     */
    static listTags({ fs, gitdir }: {
        fs: FSClient;
        gitdir?: string | undefined;
    }): Promise<string[]>;
}
