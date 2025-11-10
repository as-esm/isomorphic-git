export class UnmergedPathsError extends BaseError {
    /**
     * @param {Array<string>} filepaths
     */
    constructor(filepaths: Array<string>);
    code: "UnmergedPathsError";
    name: "UnmergedPathsError";
    data: {
        filepaths: string[];
    };
}
export namespace UnmergedPathsError {
    let code: "UnmergedPathsError";
}
import { BaseError } from './BaseError.js';
