export class InternalError extends BaseError {
    /**
     * @param {string} message
     */
    constructor(message: string);
    code: "InternalError";
    name: "InternalError";
    data: {
        message: string;
    };
}
export namespace InternalError {
    let code: "InternalError";
}
import { BaseError } from './BaseError.js';
