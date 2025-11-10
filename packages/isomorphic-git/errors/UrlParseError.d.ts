export class UrlParseError extends BaseError {
    /**
     * @param {string} url
     */
    constructor(url: string);
    code: "UrlParseError";
    name: "UrlParseError";
    data: {
        url: string;
    };
}
export namespace UrlParseError {
    let code: "UrlParseError";
}
import { BaseError } from './BaseError.js';
