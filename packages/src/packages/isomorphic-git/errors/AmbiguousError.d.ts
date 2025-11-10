export class AmbiguousError extends BaseError {
    /**
     * @param {'oids'|'refs'} nouns
     * @param {string} short
     * @param {string[]} matches
     */
    constructor(nouns: "oids" | "refs", short: string, matches: string[]);
    code: "AmbiguousError";
    name: "AmbiguousError";
    data: {
        nouns: "oids" | "refs";
        short: string;
        matches: string[];
    };
}
export namespace AmbiguousError {
    let code: "AmbiguousError";
}
import { BaseError } from './BaseError.js';
