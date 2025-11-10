export class IndexResetError extends BaseError {
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
