export class SmartHttpError extends BaseError {
    /**
     * @param {string} preview
     * @param {string} response
     */
    constructor(preview: string, response: string);
    code: "SmartHttpError";
    name: "SmartHttpError";
    data: {
        preview: string;
        response: string;
    };
}
export namespace SmartHttpError {
    let code: "SmartHttpError";
}
import { BaseError } from './BaseError.js';
