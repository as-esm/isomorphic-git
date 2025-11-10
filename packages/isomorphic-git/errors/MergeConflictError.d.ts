export class MergeConflictError extends BaseError {
    /**
     * @param {Array<string>} filepaths
     * @param {Array<string>} bothModified
     * @param {Array<string>} deleteByUs
     * @param {Array<string>} deleteByTheirs
     */
    constructor(filepaths: Array<string>, bothModified: Array<string>, deleteByUs: Array<string>, deleteByTheirs: Array<string>);
    code: "MergeConflictError";
    name: "MergeConflictError";
    data: {
        filepaths: string[];
        bothModified: string[];
        deleteByUs: string[];
        deleteByTheirs: string[];
    };
}
export namespace MergeConflictError {
    let code: "MergeConflictError";
}
import { BaseError } from './BaseError.js';
