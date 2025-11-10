export class AlreadyExistsError extends BaseError {
    /**
     * @param {'note'|'remote'|'tag'|'branch'} noun
     * @param {string} where
     * @param {boolean} canForce
     */
    constructor(noun: "note" | "remote" | "tag" | "branch", where: string, canForce?: boolean);
    code: "AlreadyExistsError";
    name: "AlreadyExistsError";
    data: {
        noun: "tag" | "branch" | "note" | "remote";
        where: string;
        canForce: boolean;
    };
}
export namespace AlreadyExistsError {
    let code: "AlreadyExistsError";
}
import { BaseError } from './BaseError.js';
