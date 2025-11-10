export class ParseError extends BaseError {
    /**
     * @param {string} expected
     * @param {string} actual
     */
    constructor(expected: string, actual: string);
    code: "ParseError";
    name: "ParseError";
    data: {
        expected: string;
        actual: string;
    };
}
export namespace ParseError {
    let code: "ParseError";
}
import { BaseError } from './BaseError.js';
