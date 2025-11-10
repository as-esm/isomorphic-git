export class MaxDepthError extends BaseError {
    /**
     * @param {number} depth
     */
    constructor(depth: number);
    code: "MaxDepthError";
    name: "MaxDepthError";
    data: {
        depth: number;
    };
}
export namespace MaxDepthError {
    let code: "MaxDepthError";
}
import { BaseError } from './BaseError.js';
