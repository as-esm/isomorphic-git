export class CommitNotFetchedError extends BaseError {
    /**
     * @param {string} ref
     * @param {string} oid
     */
    constructor(ref: string, oid: string);
    code: "CommitNotFetchedError";
    name: "CommitNotFetchedError";
    data: {
        ref: string;
        oid: string;
    };
}
export namespace CommitNotFetchedError {
    let code: "CommitNotFetchedError";
}
import { BaseError } from './BaseError.js';
