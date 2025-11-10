export class NoRefspecError extends BaseError {
    /**
     * @param {string} remote
     */
    constructor(remote: string);
    code: "NoRefspecError";
    name: "NoRefspecError";
    data: {
        remote: string;
    };
}
export namespace NoRefspecError {
    let code: "NoRefspecError";
}
import { BaseError } from './BaseError.js';
