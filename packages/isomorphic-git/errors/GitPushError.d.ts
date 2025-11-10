export class GitPushError extends BaseError {
    /**
     * @param {string} prettyDetails
     * @param {PushResult} result
     */
    constructor(prettyDetails: string, result: PushResult);
    code: "GitPushError";
    name: "GitPushError";
    data: {
        prettyDetails: string;
        result: PushResult;
    };
}
export namespace GitPushError {
    let code: "GitPushError";
}
import { BaseError } from './BaseError.js';
