export class ObjectTypeError extends BaseError {
    /**
     * @param {string} oid
     * @param {'blob'|'commit'|'tag'|'tree'} actual
     * @param {'blob'|'commit'|'tag'|'tree'} expected
     * @param {string} [filepath]
     */
    constructor(oid: string, actual: "blob" | "commit" | "tag" | "tree", expected: "blob" | "commit" | "tag" | "tree", filepath?: string);
    code: "ObjectTypeError";
    name: "ObjectTypeError";
    data: {
        oid: string;
        actual: "commit" | "blob" | "tree" | "tag";
        expected: "commit" | "blob" | "tree" | "tag";
        filepath: string | undefined;
    };
}
export namespace ObjectTypeError {
    let code: "ObjectTypeError";
}
import { BaseError } from './BaseError.js';
