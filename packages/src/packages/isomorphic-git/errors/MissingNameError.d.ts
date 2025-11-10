export class MissingNameError extends BaseError {
    /**
     * @param {'author'|'committer'|'tagger'} role
     */
    constructor(role: "author" | "committer" | "tagger");
    code: "MissingNameError";
    name: "MissingNameError";
    data: {
        role: "author" | "committer" | "tagger";
    };
}
export namespace MissingNameError {
    let code: "MissingNameError";
}
import { BaseError } from './BaseError.js';
