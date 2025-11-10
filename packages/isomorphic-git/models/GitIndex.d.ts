export class GitIndex {
    static from(buffer: any): Promise<GitIndex>;
    static fromBuffer(buffer: any): Promise<GitIndex>;
    static _entryToBuffer(entry: any): Promise<Buffer<ArrayBuffer>>;
    constructor(entries: any, unmergedPaths: any);
    _dirty: boolean;
    _unmergedPaths: any;
    _entries: any;
    _addEntry(entry: any): void;
    get unmergedPaths(): any[];
    get entries(): any[];
    get entriesMap(): any;
    get entriesFlat(): any[];
    insert({ filepath, stats, oid, stage }: {
        filepath: any;
        stats: any;
        oid: any;
        stage?: number | undefined;
    }): void;
    delete({ filepath }: {
        filepath: any;
    }): void;
    clear(): void;
    has({ filepath }: {
        filepath: any;
    }): any;
    render(): string;
    toObject(): Promise<Buffer<ArrayBuffer>>;
    [Symbol.iterator](): Generator<any, void, unknown>;
}
