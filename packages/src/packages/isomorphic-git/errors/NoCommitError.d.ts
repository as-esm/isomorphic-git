export class NoCommitError extends BaseError {
    /**
     * @param {string} ref
     */
    constructor(ref: string);
    code: "NoCommitError";
    name: "NoCommitError";
    data: {
        ref: string;
    };
}
export namespace NoCommitError {
    let code: "NoCommitError";
}
import { BaseError } from './BaseError.js';
