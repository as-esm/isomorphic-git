export class HttpError extends BaseError {
    /**
     * @param {number} statusCode
     * @param {string} statusMessage
     * @param {string} response
     */
    constructor(statusCode: number, statusMessage: string, response: string);
    code: "HttpError";
    name: "HttpError";
    data: {
        statusCode: number;
        statusMessage: string;
        response: string;
    };
}
export namespace HttpError {
    let code: "HttpError";
}
import { BaseError } from './BaseError.js';
