export class CheckoutConflictError extends BaseError {
    /**
     * @param {string[]} filepaths
     */
    constructor(filepaths: string[]);
    code: "CheckoutConflictError";
    name: "CheckoutConflictError";
    data: {
        filepaths: string[];
    };
}
export namespace CheckoutConflictError {
    let code: "CheckoutConflictError";
}
import { BaseError } from './BaseError.js';
