export class GitTree {
    static from(tree: any): GitTree;
    constructor(entries: any);
    _entries: any[];
    render(): string;
    toObject(): Buffer<ArrayBuffer>;
    /**
     * @returns {TreeEntry[]}
     */
    entries(): TreeEntry[];
    [Symbol.iterator](): Generator<any, void, unknown>;
}
export type TreeEntry = {
    /**
     * - the 6 digit hexadecimal mode
     */
    mode: string;
    /**
     * - the name of the file or directory
     */
    path: string;
    /**
     * - the SHA-1 object id of the blob or tree
     */
    oid: string;
    /**
     * - the type of object
     */
    type: "commit" | "blob" | "tree";
};
