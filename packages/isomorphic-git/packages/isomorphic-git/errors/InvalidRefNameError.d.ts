export class InvalidRefNameError extends BaseError {
    /**
     * @param {string} ref
     * @param {string} suggestion
     * @param {boolean} canForce
     */
    constructor(ref: string, suggestion: string);
    code: "InvalidRefNameError";
    name: "InvalidRefNameError";
    data: {
        ref: string;
        suggestion: string;
    };
}
export namespace InvalidRefNameError {
    let code: "InvalidRefNameError";
}
import { BaseError } from './BaseError.js';
