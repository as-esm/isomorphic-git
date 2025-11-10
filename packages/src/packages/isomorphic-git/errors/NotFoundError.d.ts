export class NotFoundError extends BaseError {
    /**
     * @param {string} what
     */
    constructor(what: string);
    code: "NotFoundError";
    name: "NotFoundError";
    data: {
        what: string;
    };
}
export namespace NotFoundError {
    let code: "NotFoundError";
}
import { BaseError } from './BaseError.js';
