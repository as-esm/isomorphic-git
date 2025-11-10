export class IndexResetError extends BaseError {
    /**
     * @param {Array<string>} filepaths
     */
    constructor(filepath: any);
    code: "IndexResetError";
    name: "IndexResetError";
    data: {
        filepath: any;
    };
}
export namespace IndexResetError {
    let code: "IndexResetError";
}
import { BaseError } from './BaseError.js';
