export class InvalidOidError extends BaseError {
    /**
     * @param {string} value
     */
    constructor(value: string);
    code: "InvalidOidError";
    name: "InvalidOidError";
    data: {
        value: string;
    };
}
export namespace InvalidOidError {
    let code: "InvalidOidError";
}
import { BaseError } from './BaseError.js';
