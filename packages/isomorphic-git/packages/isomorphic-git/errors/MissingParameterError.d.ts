export class MissingParameterError extends BaseError {
    /**
     * @param {string} parameter
     */
    constructor(parameter: string);
    code: "MissingParameterError";
    name: "MissingParameterError";
    data: {
        parameter: string;
    };
}
export namespace MissingParameterError {
    let code: "MissingParameterError";
}
import { BaseError } from './BaseError.js';
