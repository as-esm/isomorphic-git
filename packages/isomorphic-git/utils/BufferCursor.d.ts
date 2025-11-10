export class BufferCursor {
    constructor(buffer: any);
    buffer: any;
    _start: number;
    eof(): boolean;
    tell(): number;
    seek(n: any): void;
    slice(n: any): any;
    toString(enc: any, length: any): any;
    write(value: any, length: any, enc: any): any;
    copy(source: any, start: any, end: any): any;
    readUInt8(): any;
    writeUInt8(value: any): any;
    readUInt16BE(): any;
    writeUInt16BE(value: any): any;
    readUInt32BE(): any;
    writeUInt32BE(value: any): any;
}
