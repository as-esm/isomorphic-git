export class StreamReader {
    constructor(stream: any);
    stream: any;
    buffer: any;
    cursor: number;
    undoCursor: number;
    started: boolean;
    _ended: boolean;
    _discardedBytes: number;
    eof(): boolean;
    tell(): number;
    byte(): Promise<any>;
    chunk(): Promise<any>;
    read(n: any): Promise<any>;
    skip(n: any): Promise<void>;
    undo(): Promise<void>;
    _next(): Promise<any>;
    _trim(): void;
    _moveCursor(n: any): void;
    _accumulate(n: any): Promise<void>;
    _loadnext(): Promise<void>;
    _init(): Promise<void>;
}
