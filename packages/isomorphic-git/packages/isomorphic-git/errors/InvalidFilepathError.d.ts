export class InvalidFilepathError extends BaseError {
    /**
     * @param {'leading-slash'|'trailing-slash'|'directory'} [reason]
     */
    constructor(reason?: "leading-slash" | "trailing-slash" | "directory");
    code: "InvalidFilepathError";
    name: "InvalidFilepathError";
    data: {
        reason: "leading-slash" | "trailing-slash" | "directory" | undefined;
    };
}
export namespace InvalidFilepathError {
    let code: "InvalidFilepathError";
}
import { BaseError } from './BaseError.js';
