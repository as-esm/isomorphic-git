export class EmptyServerResponseError extends BaseError {
    constructor();
    code: "EmptyServerResponseError";
    name: "EmptyServerResponseError";
    data: {};
}
export namespace EmptyServerResponseError {
    let code: "EmptyServerResponseError";
}
import { BaseError } from './BaseError.js';
