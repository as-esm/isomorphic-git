/**
 * Manages access to the Git configuration file, providing methods to read and save configurations.
 */
export class GitConfigManager {
    /**
     * Reads the Git configuration file from the specified `.git` directory.
     *
     * @param {object} opts - Options for reading the Git configuration.
     * @param {FSClient} opts.fs - A file system implementation.
     * @param {string} opts.gitdir - The path to the `.git` directory.
     * @returns {Promise<GitConfig>} A `GitConfig` object representing the parsed configuration.
     */
    static get({ fs, gitdir }: {
        fs: FSClient;
        gitdir: string;
    }): Promise<GitConfig>;
    /**
     * Saves the provided Git configuration to the specified `.git` directory.
     *
     * @param {object} opts - Options for saving the Git configuration.
     * @param {FSClient} opts.fs - A file system implementation.
     * @param {string} opts.gitdir - The path to the `.git` directory.
     * @param {GitConfig} opts.config - The `GitConfig` object to save.
     * @returns {Promise<void>} Resolves when the configuration has been successfully saved.
     */
    static save({ fs, gitdir, config }: {
        fs: FSClient;
        gitdir: string;
        config: GitConfig;
    }): Promise<void>;
}
import { GitConfig } from '../models/GitConfig.js';
