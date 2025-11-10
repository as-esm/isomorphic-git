export class PushRejectedError extends BaseError {
    /**
     * @param {'not-fast-forward'|'tag-exists'} reason
     */
    constructor(reason: "not-fast-forward" | "tag-exists");
    code: "PushRejectedError";
    name: "PushRejectedError";
    data: {
        reason: "not-fast-forward" | "tag-exists";
    };
}
export namespace PushRejectedError {
    let code: "PushRejectedError";
}
import { BaseError } from './BaseError.js';
