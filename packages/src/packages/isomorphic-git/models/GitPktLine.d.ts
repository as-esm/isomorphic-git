export class GitPktLine {
    static flush(): Buffer<ArrayBuffer>;
    static delim(): Buffer<ArrayBuffer>;
    static encode(line: any): Buffer<ArrayBuffer>;
    static streamReader(stream: any): () => Promise<any>;
}
