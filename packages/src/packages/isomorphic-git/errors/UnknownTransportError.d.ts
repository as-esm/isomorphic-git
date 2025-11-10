export class UnknownTransportError extends BaseError {
    /**
     * @param {string} url
     * @param {string} transport
     * @param {string} [suggestion]
     */
    constructor(url: string, transport: string, suggestion?: string);
    code: "UnknownTransportError";
    name: "UnknownTransportError";
    data: {
        url: string;
        transport: string;
        suggestion: string | undefined;
    };
}
export namespace UnknownTransportError {
    let code: "UnknownTransportError";
}
import { BaseError } from './BaseError.js';
