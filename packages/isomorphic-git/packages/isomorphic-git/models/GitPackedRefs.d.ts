export class GitPackedRefs {
    static from(text: any): GitPackedRefs;
    constructor(text: any);
    refs: Map<any, any>;
    parsedConfig: any;
    delete(ref: any): void;
    toString(): string;
}
