export class UnsafeFilepathError extends BaseError {
    /**
     * @param {string} filepath
     */
    constructor(filepath: string);
    code: "UnsafeFilepathError";
    name: "UnsafeFilepathError";
    data: {
        filepath: string;
    };
}
export namespace UnsafeFilepathError {
    let code: "UnsafeFilepathError";
}
import { BaseError } from './BaseError.js';
