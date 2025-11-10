export class MultipleGitError extends BaseError {
    /**
     * @param {Error[]} errors
     * @param {string} message
     */
    constructor(errors: Error[]);
    code: "MultipleGitError";
    name: "MultipleGitError";
    data: {
        errors: Error[];
    };
    errors: Error[];
}
export namespace MultipleGitError {
    let code: "MultipleGitError";
}
import { BaseError } from './BaseError.js';
